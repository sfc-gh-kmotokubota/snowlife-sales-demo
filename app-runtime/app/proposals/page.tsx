import Link from "next/link"
import { FileText, Lightbulb } from "lucide-react"
import { getCompanyOptions, getProposals, getProposalStories } from "@/lib/queries"
import { formatJpy, formatNum } from "@/lib/format"
import { EmptyState, GradeBadge, Panel } from "@/components/ui-kit"

export const dynamic = "force-dynamic"

export default async function ProposalsPage({
  searchParams,
}: {
  searchParams: Promise<{ rep?: string }>
}) {
  const { rep } = await searchParams
  const [companies, stories, proposals] = await Promise.all([
    getCompanyOptions(rep ?? null),
    getProposalStories(null, rep ?? null),
    getProposals(null, rep ?? null),
  ])

  const href = (p: string) =>
    rep ? `${p}${p.includes("?") ? "&" : "?"}rep=${encodeURIComponent(rep)}` : p
  const storyCount = new Map<string, number>()
  for (const s of stories) storyCount.set(s.companyId, (storyCount.get(s.companyId) ?? 0) + 1)
  const proposalCount = new Map<string, number>()
  for (const p of proposals) proposalCount.set(p.companyId, (proposalCount.get(p.companyId) ?? 0) + 1)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">提案ストーリー・提案書</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          企業を選ぶと、求人シグナル・過去商談のニーズ・トップ営業の暗黙知を踏まえた提案ストーリーと提案書を生成できます。
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="panel px-3.5 py-3">
          <div className="metric-label">対象企業</div>
          <div className="metric-value mt-0.5">{companies.length}社</div>
        </div>
        <div className="panel px-3.5 py-3">
          <div className="metric-label">作成済み提案ストーリー</div>
          <div className="metric-value mt-0.5">{stories.length}件</div>
        </div>
        <div className="panel px-3.5 py-3">
          <div className="metric-label">作成済み提案書</div>
          <div className="metric-value mt-0.5">{proposals.length}件</div>
        </div>
      </div>

      <Panel title="企業一覧（アタック優先度順）" bodyClassName="p-0">
        {companies.length === 0 ? (
          <EmptyState message="対象企業がありません。" />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-8">優先</th>
                <th className="min-w-[14rem]">企業名</th>
                <th>業種</th>
                <th className="w-20 text-right">従業員数</th>
                <th className="w-16 text-right">スコア</th>
                <th className="w-24 text-center">ストーリー</th>
                <th className="w-20 text-center">提案書</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.companyId}>
                  <td>
                    <GradeBadge grade={c.grade} />
                  </td>
                  <td>
                    <Link
                      href={href(`/proposals/${c.companyId}`)}
                      className="font-medium text-slate-900 hover:text-[var(--brand-primary)] hover:underline"
                    >
                      {c.companyName}
                    </Link>
                  </td>
                  <td className="text-[12px] text-slate-600">{c.industryLarge}</td>
                  <td className="text-right tabular-nums">{formatNum(c.employeeCount)}</td>
                  <td className="text-right font-semibold tabular-nums">{c.totalScore}</td>
                  <td className="text-center">
                    {storyCount.get(c.companyId) ? (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
                        <Lightbulb className="h-2.5 w-2.5" />
                        {storyCount.get(c.companyId)}件
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">未作成</span>
                    )}
                  </td>
                  <td className="text-center">
                    {proposalCount.get(c.companyId) ? (
                      <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700">
                        <FileText className="h-2.5 w-2.5" />
                        {proposalCount.get(c.companyId)}件
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">未作成</span>
                    )}
                  </td>
                  <td>
                    <Link
                      href={href(`/proposals/${c.companyId}`)}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-[12px]
                                 font-medium text-slate-700 hover:bg-slate-50"
                    >
                      作成・編集
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {proposals.length > 0 && (
        <Panel title="最近作成した提案書" bodyClassName="p-0">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-20">作成日</th>
                <th className="w-40">企業名</th>
                <th>タイトル</th>
                <th className="w-14 text-right">版</th>
                <th className="w-24 text-right">想定保険料</th>
              </tr>
            </thead>
            <tbody>
              {proposals.slice(0, 10).map((p) => (
                <tr key={p.proposalId}>
                  <td className="whitespace-nowrap text-[12px] text-slate-600">
                    {p.createdAt?.slice(0, 10)}
                  </td>
                  <td>
                    <Link
                      href={href(`/proposals/${p.companyId}`)}
                      className="font-medium hover:text-[var(--brand-primary)] hover:underline"
                    >
                      {p.companyName}
                    </Link>
                  </td>
                  <td className="text-[12px] text-slate-700">{p.title}</td>
                  <td className="text-right tabular-nums">v{p.version}</td>
                  <td className="text-right tabular-nums">{formatJpy(p.estimatedPremium)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  )
}
