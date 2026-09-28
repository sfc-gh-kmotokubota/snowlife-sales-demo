import { getSalesReps } from "@/lib/queries"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return Response.json(await getSalesReps())
  } catch (e) {
    console.error(new Date().toISOString(), "[api/reps] failed to load sales reps", e)
    return Response.json(
      { error: e instanceof Error ? e.message : "営業員の取得に失敗しました" },
      { status: 500 },
    )
  }
}
