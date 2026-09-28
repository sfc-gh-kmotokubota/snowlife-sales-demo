import Link from "next/link"
import { AlertTriangle, ArrowRight, Briefcase, CalendarClock, Target, TrendingUp } from "lucide-react"
import { getDashboard, getSalesReps } from "@/lib/queries"
import { daysAgoLabel, formatJpy, formatNum } from "@/lib/format"
import {
  EmptyState,
  GradeBadge,
  KpiCard,
  OutcomeBadge,
  Panel,
  PriorityBadge,
  SentimentBadge,
  TierBadge,
  TriggerBadge,
} from "@/components/ui-kit"
import { QualityTrendChart, SignalMixChart } from "@/components/dashboard-charts"

export const dynamic = "force-dynamic"

function repLink(href: string, rep: string | undefined) {
  return rep ? `${href}${href.includes("?") ? "&" : "?"}rep=${encodeURIComponent(rep)}` : href
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ rep?: string }>
}) {
  const { rep } = await searchParams
  const [data, reps] = await Promise.all([getDashboard(rep ?? null), getSalesReps()])
  const activeRep = reps.find((r) => r.repId === rep)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">営業ダッシュボード</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {activeRep ? (
              <span className="inline-flex items-center gap-1.5">
                {activeRep.name}
                <TierBadge tier={activeRep.skillTier} />
                <span>
                  担当 {activeRep.companyCount}社 / 成約率 {Math.round(activeRep.winRate * 100)}% /
                  経験 {activeRep.experienceYears}年
                </span>
              </span>
            ) : (
              "全営業員の担当先を表示しています。右上のセレクタで営業員を切り替えられます。"
            )}
          </p>
        </div>
        <Link
          href={repLink("/attack-list", rep)}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-primary)] px-3 py-2
                     text-xs font-medium text-white hover:opacity-90"
        >
          <Target className="h-3.5 w-3.5" />
          アタックリストを抽出する
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <KpiCard label="担当企業数" value={`${formatNum(data.kpi.companyCount)}社`} />
        <KpiCard
          label="見込み金額"
          value={formatJpy(data.kpi.pipelineAmount)}
          sub="有効な見込み案件の合計"
        />
        <KpiCard
          label="90日以内満期"
          value={`${formatNum(data.kpi.expiring90d)}件`}
          tone={data.kpi.expiring90d > 0 ? "danger" : "default"}
          sub="更新提案のタイミング"
        />
        <KpiCard
          label="求人シグナル強"
          value={`${formatNum(data.kpi.strongSignalCompanies)}社`}
          tone={data.kpi.strongSignalCompanies > 0 ? "warn" : "default"}
          sub="スコア85以上"
        />
        <KpiCard
          label="キーマン未接触"
          value={`${formatNum(data.kpi.keyPersonGaps)}社`}
          tone={data.kpi.keyPersonGaps > 0 ? "warn" : "good"}
          sub="決裁者への接点なし"
        />
        <KpiCard
          label="商談品質スコア"
          value={data.kpi.avgMeetingQuality ? `${data.kpi.avgMeetingQuality}` : "—"}
          tone={
            data.kpi.avgMeetingQuality >= 60
              ? "good"
              : data.kpi.avgMeetingQuality >= 35
                ? "warn"
                : "danger"
          }
          sub="担当商談の平均（100点満点）"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Top targets */}
        <div className="xl:col-span-2">
          <Panel
            title={
              <span className="inline-flex items-center gap-1.5">
                <Target className="h-4 w-4 text-[var(--brand-primary)]" />
                優先アプローチ先
              </span>
            }
            actions={
              <Link
                href={repLink("/attack-list", rep)}
                className="text-[12px] text-[var(--brand-primary)] hover:underline"
              >
                すべて見る
              </Link>
            }
            bodyClassName="p-0"
          >
            {data.topTargets.length === 0 ? (
              <EmptyState message="対象企業がありません。" />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-8">優先</th>
                    <th>企業名</th>
                    <th className="w-16 text-right">スコア</th>
                    <th>検出トリガー</th>
                    <th className="w-24">求人シグナル</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topTargets.map((t) => (
                    <tr key={t.companyId}>
                      <td>
                        <GradeBadge grade={t.grade} />
                      </td>
                      <td>
                        <Link
                          href={repLink(`/customers/${t.companyId}`, rep)}
                          className="font-medium text-slate-900 hover:text-[var(--brand-primary)] hover:underline"
                        >
                          {t.companyName}
                        </Link>
                        <div className="text-[11px] text-muted-foreground">
                          従業員 {formatNum(t.employeeCount)}名
                        </div>
                      </td>
                      <td className="text-right font-semibold tabular-nums">{t.totalScore}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {t.triggers.slice(0, 3).map((tr) => (
                            <TriggerBadge key={tr} trigger={tr} />
                          ))}
                          {t.triggers.length > 3 && (
                            <span className="text-[11px] text-muted-foreground">
                              +{t.triggers.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-[12px] text-slate-600">{t.topSignalType ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        {/* Urgent actions */}
        <Panel
          title={
            <span className="inline-flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              本日のアクション
            </span>
          }
          actions={
            <span className="text-[12px] text-muted-foreground">
              未着手 {data.kpi.openActions} / 遅延 {data.kpi.overdueActions}
            </span>
          }
          bodyClassName="p-0"
        >
          {data.urgentActions.length === 0 ? (
            <EmptyState message="未着手のアクションはありません。" />
          ) : (
            <ul className="divide-y divide-border">
              {data.urgentActions.map((a) => (
                <li key={a.actionId} className="px-3.5 py-2.5">
                  <div className="flex items-start gap-2">
                    <PriorityBadge priority={a.priority} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-slate-900">{a.title}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Link
                          href={repLink(`/customers/${a.companyId}`, rep)}
                          className="hover:underline"
                        >
                          {a.companyName}
                        </Link>
                        <span>期限 {a.dueDate ?? "—"}</span>
                        {a.status === "遅延" && (
                          <span className="font-medium text-rose-600">遅延</span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Expiring contracts */}
        <Panel
          title={
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4 text-rose-500" />
              満期接近契約（120日以内）
            </span>
          }
          bodyClassName="p-0"
        >
          {data.expiringContracts.length === 0 ? (
            <EmptyState message="120日以内に満期を迎える契約はありません。" />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>企業名</th>
                  <th>商品</th>
                  <th className="w-20 text-right">年間保険料</th>
                  <th className="w-20 text-right">残日数</th>
                </tr>
              </thead>
              <tbody>
                {data.expiringContracts.map((c) => (
                  <tr key={c.contractId}>
                    <td>
                      <Link
                        href={repLink(`/customers/${c.companyId}`, rep)}
                        className="font-medium hover:text-[var(--brand-primary)] hover:underline"
                      >
                        {c.companyName}
                      </Link>
                    </td>
                    <td className="text-[12px] text-slate-600">{c.productName}</td>
                    <td className="text-right tabular-nums">{formatJpy(c.annualPremium)}</td>
                    <td className="text-right">
                      <span
                        className={
                          c.daysToExpiry <= 30
                            ? "font-semibold text-rose-600"
                            : c.daysToExpiry <= 90
                              ? "font-medium text-amber-600"
                              : "text-slate-600"
                        }
                      >
                        {c.daysToExpiry}日
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        {/* Recent meetings */}
        <Panel
          title={
            <span className="inline-flex items-center gap-1.5">
              <Briefcase className="h-4 w-4 text-[var(--brand-primary)]" />
              直近の商談
            </span>
          }
          actions={
            <Link
              href={repLink("/meetings", rep)}
              className="text-[12px] text-[var(--brand-primary)] hover:underline"
            >
              すべて見る
            </Link>
          }
          bodyClassName="p-0"
        >
          {data.recentMeetings.length === 0 ? (
            <EmptyState message="商談履歴がありません。" />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-20">商談日</th>
                  <th>企業名 / 議題</th>
                  <th className="w-20">結果</th>
                  <th className="w-16">反応</th>
                  <th className="w-14 text-right">品質</th>
                </tr>
              </thead>
              <tbody>
                {data.recentMeetings.map((m) => (
                  <tr key={m.meetingId}>
                    <td className="whitespace-nowrap text-[12px] text-slate-600">
                      {m.meetingDate}
                    </td>
                    <td>
                      <Link
                        href={repLink(`/meetings/${m.meetingId}`, rep)}
                        className="font-medium hover:text-[var(--brand-primary)] hover:underline"
                      >
                        {m.companyName}
                      </Link>
                      <div className="text-[11px] text-muted-foreground">{m.agenda}</div>
                    </td>
                    <td>
                      <OutcomeBadge outcome={m.outcome} />
                    </td>
                    <td>
                      <SentimentBadge sentiment={m.sentiment} />
                    </td>
                    <td className="text-right">
                      <span
                        className={
                          m.qualityScore >= 60
                            ? "font-semibold text-emerald-600"
                            : m.qualityScore >= 35
                              ? "font-medium text-amber-600"
                              : "font-medium text-rose-600"
                        }
                      >
                        {m.qualityScore}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title={
            <span className="inline-flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-[var(--brand-primary)]" />
              商談品質スコアの推移
            </span>
          }
        >
          <QualityTrendChart data={data.qualityTrend} />
        </Panel>

        <Panel title="求人シグナルの構成（直近180日）">
          <SignalMixChart data={data.signalMix} />
        </Panel>
      </div>
    </div>
  )
}
