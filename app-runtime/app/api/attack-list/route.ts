import { getAttackList, getFilterOptions, type AttackListFilters } from "@/lib/queries"

export const dynamic = "force-dynamic"

/** Parse a repeatable / comma-separated query param into a string array. */
function list(params: URLSearchParams, key: string): string[] {
  const raw = params.getAll(key).flatMap((v) => v.split(","))
  return raw.map((v) => v.trim()).filter(Boolean)
}

function num(params: URLSearchParams, key: string): number | null {
  const v = params.get(key)
  if (v === null || v.trim() === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams
    const filters: AttackListFilters = {
      repId: params.get("rep"),
      industries: list(params, "industry"),
      signalTypes: list(params, "signal"),
      triggers: list(params, "trigger"),
      grades: list(params, "grade"),
      minEmployees: num(params, "minEmployees"),
      minScore: num(params, "minScore"),
    }
    const [rows, options] = await Promise.all([getAttackList(filters), getFilterOptions()])
    return Response.json({ rows, options })
  } catch (e) {
    console.error(new Date().toISOString(), "[api/attack-list] query failed", e)
    return Response.json(
      { error: e instanceof Error ? e.message : "アタックリストの取得に失敗しました" },
      { status: 500 },
    )
  }
}
