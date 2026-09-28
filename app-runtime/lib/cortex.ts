import { querySnowflakeLongRunning } from "@/lib/snowflake"
import { CORTEX_MODEL } from "@/lib/constants"
import { sqlStr } from "@/lib/format"

/**
 * Server-side helpers for the generative features (proposal story, proposal
 * document, needs deep-dive). Every generation runs through
 * `SNOWFLAKE.CORTEX.COMPLETE` inside the account — no data leaves Snowflake.
 *
 * These calls routinely take 20-60 seconds, so they always use
 * `querySnowflakeLongRunning` (async submit + poll) rather than the default
 * helper, which would otherwise block a pooled connection for the duration.
 */

export interface CompleteOptions {
  temperature?: number
  maxTokens?: number
  /** Fail the request if generation has not finished within this many ms. */
  maxWaitMs?: number
}

/**
 * Run a single-prompt Cortex COMPLETE call and return the raw model text.
 *
 * The prompt is passed as a messages array because the three-argument form of
 * `COMPLETE` (the one that accepts an options object) requires it — passing a
 * bare string there raises "Invalid argument types for function COMPLETE".
 */
export async function cortexComplete(prompt: string, opts: CompleteOptions = {}): Promise<string> {
  const { temperature = 0.4, maxTokens = 8000, maxWaitMs = 300_000 } = opts
  const budget = Math.floor(maxTokens)

  const sql = `
    WITH r AS (
      SELECT SNOWFLAKE.CORTEX.COMPLETE(
        '${sqlStr(CORTEX_MODEL)}',
        ARRAY_CONSTRUCT(OBJECT_CONSTRUCT('role','user','content','${sqlStr(prompt)}')),
        OBJECT_CONSTRUCT('temperature', ${temperature}, 'max_tokens', ${budget})
      ) AS RESP
    )
    SELECT RESP:choices[0].messages::TEXT AS OUTPUT,
           RESP:usage.completion_tokens::NUMBER AS COMPLETION_TOKENS
    FROM r
  `

  const rows = await querySnowflakeLongRunning(sql, {
    pollIntervalMs: 3000,
    statusLogIntervalMs: 15_000,
    maxWaitMs,
  })

  const text = rows[0]?.OUTPUT
  if (typeof text !== "string" || text.trim() === "") {
    throw new Error("Cortex COMPLETE が空の応答を返しました")
  }

  /**
   * Cortex does not set `finish_reason` when a generation hits the token ceiling,
   * so an over-budget response arrives as silently truncated text. That surfaces
   * downstream as an opaque "JSON を抽出できませんでした" error, which is very hard
   * to diagnose. Compare the consumed tokens against the budget and say so.
   */
  const used = Number(rows[0]?.COMPLETION_TOKENS ?? 0)
  if (used >= budget) {
    throw new Error(
      `モデル出力が上限 ${budget} トークンに達して途中で切れました（消費 ${used}）。max_tokens を引き上げてください。`,
    )
  }

  return text
}

/**
 * Extract the first JSON object or array from a model response.
 *
 * Models frequently wrap JSON in a markdown fence or prepend a sentence despite
 * being told not to, so we slice from the first opening brace/bracket to the
 * matching final one rather than trusting the raw string.
 */
export function extractJson<T>(raw: string): T {
  const trimmed = raw.trim()

  const candidates: string[] = []
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced?.[1]) candidates.push(fenced[1].trim())

  for (const [open, close] of [
    ["{", "}"],
    ["[", "]"],
  ] as const) {
    const start = trimmed.indexOf(open)
    const end = trimmed.lastIndexOf(close)
    if (start !== -1 && end > start) candidates.push(trimmed.slice(start, end + 1))
  }
  candidates.push(trimmed)

  for (const c of candidates) {
    try {
      return JSON.parse(c) as T
    } catch {
      // try the next candidate
    }
  }
  throw new Error("モデル応答からJSONを抽出できませんでした")
}

/** Convenience wrapper: generate and parse in one call. */
export async function cortexCompleteJson<T>(prompt: string, opts?: CompleteOptions): Promise<T> {
  return extractJson<T>(await cortexComplete(prompt, opts))
}

/** Consistent 500 response for the AI routes. */
export function aiError(scope: string, e: unknown): Response {
  console.error(new Date().toISOString(), `[${scope}] generation failed`, e)
  return Response.json(
    { error: e instanceof Error ? e.message : "AI生成に失敗しました" },
    { status: 500 },
  )
}
