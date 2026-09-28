import { querySnowflake } from "@/lib/snowflake"
import { AI_SCHEMA, SEARCH_SCHEMA } from "@/lib/constants"
import { safeId, sqlStr, toNum } from "@/lib/format"
import { getKnowledgeStats, getTacitKnowledge } from "@/lib/queries"

export const dynamic = "force-dynamic"

/**
 * GET /api/knowledge
 *   ?category=…  filter by tacit-knowledge category
 *   ?q=…         natural-language search via the Cortex Search service
 *
 * When `q` is supplied the Cortex Search service ranks the patterns. The ranked
 * ids are flattened to scalar rows in SQL (rather than returned as a VARIANT
 * array) so the SDK hands back plain strings, then re-joined against the full
 * rows in JS to keep the response shape identical in both cases.
 */
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams
    const category = params.get("category")
    const q = (params.get("q") ?? "").trim().slice(0, 200)

    const [all, stats] = await Promise.all([getTacitKnowledge(category), getKnowledgeStats()])

    if (!q) return Response.json({ items: all, stats, searched: false })

    const rows = await querySnowflake(`
      SELECT f.INDEX AS RANK, f.VALUE:KNOWLEDGE_ID::TEXT AS KNOWLEDGE_ID
      FROM (
        SELECT PARSE_JSON(SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
          '${SEARCH_SCHEMA}.TACIT_KNOWLEDGE_SEARCH',
          '{"query":"${sqlStr(q)}","columns":["KNOWLEDGE_ID"],"limit":12}'
        )):results AS R
      ), LATERAL FLATTEN(input => R) f
      ORDER BY f.INDEX
    `)

    const byId = new Map(all.map((k) => [k.knowledgeId, k]))
    const items = rows
      .map((r) => byId.get(String(r.KNOWLEDGE_ID)))
      .filter((v): v is (typeof all)[number] => Boolean(v))

    return Response.json({ items, stats, searched: true, matched: items.length })
  } catch (e) {
    console.error(new Date().toISOString(), "[api/knowledge] failed", e)
    return Response.json(
      { error: e instanceof Error ? e.message : "暗黙知の取得に失敗しました" },
      { status: 500 },
    )
  }
}

/** Records that a pattern was referenced, so the library can surface real usage. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { knowledgeId?: string }
    const id = safeId(body.knowledgeId)
    if (!id) return Response.json({ error: "knowledgeId が不正です" }, { status: 400 })

    const rows = await querySnowflake(`
      UPDATE ${AI_SCHEMA}.T_TACIT_KNOWLEDGE
      SET USAGE_COUNT = COALESCE(USAGE_COUNT, 0) + 1
      WHERE KNOWLEDGE_ID = '${sqlStr(id)}'
    `)
    return Response.json({ updated: toNum(rows[0]?.["number of rows updated"]) })
  } catch (e) {
    console.error(new Date().toISOString(), "[api/knowledge] usage increment failed", e)
    return Response.json(
      { error: e instanceof Error ? e.message : "利用回数の更新に失敗しました" },
      { status: 500 },
    )
  }
}
