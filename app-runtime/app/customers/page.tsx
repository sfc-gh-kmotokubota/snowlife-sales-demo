import Link from "next/link"
import { getAttackList, getSalesReps } from "@/lib/queries"
import { daysAgoLabel, formatJpy, formatNum } from "@/lib/format"
import { EmptyState, GradeBadge, Panel, TierBadge, TriggerBadge } from "@/components/ui-kit"

export const dynamic = "force-dynamic"

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ rep?: string }>
}) {
  const { rep } = await searchParams
  const [rows, reps] = await Promise.all([
    getAttackList({
      repId: rep ?? null,
      industries: [],
      signalTypes: [],
      triggers: [],
      grades: [],
      minEmployees: null,
      minScore: null,
    }),
    getSalesReps(),
  ])
  const activeRep = reps.find((r) => r.repId === rep)
  const href = (path: string) => (rep ? `${path}?rep=${encodeURIComponent(rep)}` : path)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">顧客情報</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {activeRep ? (
            <span className="inline-flex items-center gap-1.5">
              {activeRep.name}
              <TierBadge tier={activeRep.skillTier} />
              の担当先 {rows.length}社
            </span>
          ) : (
            `全担当先 ${rows.length}社。企業名から360°ビューに移動できます。`
          )}
        </p>
      </div>

      <Panel title={`担当企業一覧 ${rows.length}社`} bodyClassName="p-0">
        {rows.length === 0 ? (
          <EmptyState message="担当企業がありません。" />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-8">優先</th>
                  <th className="min-w-[13rem]">企業名</th>
                  <th>業種</th>
                  <th className="w-20 text-right">従業員数</th>
                  <th className="w-16 text-center">見込み</th>
                  <th className="w-20 text-right">年間保険料</th>
                  <th className="w-16 text-right">契約数</th>
                  <th className="min-w-[10rem]">検出トリガー</th>
                  <th className="w-20 text-right">最終接触</th>
                  <th className="w-16 text-right">スコア</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.companyId}>
                    <td>
                      <GradeBadge grade={r.grade} />
                    </td>
                    <td>
                      <Link
                        href={href(`/customers/${r.companyId}`)}
                        className="font-medium text-slate-900 hover:text-[var(--brand-primary)] hover:underline"
                      >
                        {r.companyName}
                      </Link>
                      {!rep && (
                        <div className="text-[11px] text-muted-foreground">{r.salesRepName}</div>
                      )}
                    </td>
                    <td className="text-[12px] text-slate-600">{r.industryDetail}</td>
                    <td className="text-right tabular-nums">{formatNum(r.employeeCount)}</td>
                    <td className="text-center">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium">
                        {r.prospectRank}
                      </span>
                    </td>
                    <td className="text-right tabular-nums">{formatJpy(r.totalPremium)}</td>
                    <td className="text-right tabular-nums">{r.contractCount}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {r.triggers.slice(0, 3).map((t) => (
                          <TriggerBadge key={t} trigger={t} />
                        ))}
                        {r.triggers.length > 3 && (
                          <span className="text-[11px] text-muted-foreground">
                            +{r.triggers.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-right text-[12px]">
                      <span
                        className={r.daysSinceTouch > 150 ? "text-amber-600" : "text-slate-600"}
                      >
                        {daysAgoLabel(r.daysSinceTouch)}
                      </span>
                    </td>
                    <td className="text-right font-semibold tabular-nums">{r.totalScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
