"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Briefcase,
  Building2,
  FileText,
  Newspaper,
  ScrollText,
  TrendingUp,
  UserSquare2,
} from "lucide-react"
import { daysAgoLabel, formatJpy, formatNum } from "@/lib/format"
import {
  EmptyState,
  OutcomeBadge,
  Panel,
  SentimentBadge,
  SignalStrength,
} from "@/components/ui-kit"
import { FinancialTrendChart, JobPostingTrendChart } from "@/components/dashboard-charts"
import { cn } from "@/lib/utils"

type Financials = { fiscalYear: number; revenue: number; operatingProfit: number; netProfit: number; totalAssets: number; employeeCount: number; employeeCountYoy: number; averageSalary: number; welfareExpenseRatio: number; turnoverRate: number }[]
type Jobs = { postings: { postingId: string; postingDate: string | null; jobTitle: string; department: string; jobCategory: string; employmentType: string; openings: number; salaryMin: number; salaryMax: number; workLocation: string; isOverseas: boolean; requiredSkills: string[]; jobDescription: string; sourceSite: string; signalType: string; signalStrength: number; signalRationale: string }[]; byMonth: { month: string; postings: number; openings: number }[]; bySignal: { signalType: string; postings: number; openings: number; maxStrength: number; rationale: string }[] }
type Contacts = { contacts: { contactId: string; name: string; title: string; department: string; role: string; touchpointCount: number; lastTouchDate: string | null; daysSinceTouch: number; positiveTouches: number; faceToFaceCount: number; coverageStatus: string }[]; touchpoints: { touchpointId: string; contactName: string; title: string; date: string | null; type: string; channel: string; sansanRegistered: boolean; sansanCardId: string; notes: string; sentiment: string }[] }
type Contracts = { contracts: { contractId: string; productName: string; productCategory: string; productType: string; contractDate: string | null; expiryDate: string | null; annualPremium: number; insuredCount: number; status: string; daysToExpiry: number }[]; gaps: { category: string; productCount: number; products: string[] }[] }
type News = { news: { newsId: string; date: string | null; source: string; headline: string; body: string; eventType: string; sentiment: string; insuranceRelevance: string }[]; alerts: { alertId: string; detectedAt: string | null; eventType: string; summary: string; reason: string; recommendedProducts: string[]; recommendedAction: string; urgencyDays: number; status: string }[] }
type Meetings = { meetingId: string; meetingDate: string | null; agenda: string; meetingType: string; outcome: string | null; sentiment: string | null; qualityScore: number; hearingQuestionCount: number; deepNeedCount: number; missedCount: number }[]

const TABS = [
  { id: "basic", label: "基本情報", icon: Building2 },
  { id: "financial", label: "財務推移", icon: TrendingUp },
  { id: "jobs", label: "求人動向", icon: Briefcase },
  { id: "contracts", label: "契約ポートフォリオ", icon: FileText },
  { id: "contacts", label: "キーマンマップ", icon: UserSquare2 },
  { id: "news", label: "ニュース・アラート", icon: Newspaper },
  { id: "meetings", label: "商談履歴", icon: ScrollText },
] as const

const ROLE_LABEL: Record<string, string> = {
  DECISION_MAKER: "決裁者",
  INFLUENCER: "影響者",
  WINDOW: "窓口",
}

const COVERAGE_STYLE: Record<string, string> = {
  良好: "bg-emerald-100 text-emerald-800",
  接点浅い: "bg-amber-100 text-amber-800",
  接点劣化: "bg-orange-100 text-orange-800",
  未接触: "bg-rose-100 text-rose-800",
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-b border-slate-100 py-1.5">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-xs font-medium text-slate-900">{value}</dd>
    </div>
  )
}

export function CustomerTabs({
  financials,
  jobs,
  contacts,
  contracts,
  news,
  meetings,
  basic,
  repParam,
}: {
  financials: Financials
  jobs: Jobs
  contacts: Contacts
  contracts: Contracts
  news: News
  meetings: Meetings
  basic: Record<string, React.ReactNode>
  repParam: string
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("basic")
  const href = (p: string) =>
    repParam ? `${p}${p.includes("?") ? "&" : "?"}rep=${encodeURIComponent(repParam)}` : p

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex overflow-x-auto border-b border-border">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-selected={active}
              role="tab"
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-xs font-medium transition-colors",
                active
                  ? "border-[var(--brand-primary)] text-[var(--brand-primary)]"
                  : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Basic */}
      {tab === "basic" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="企業基本情報">
            <dl>
              {Object.entries(basic)
                .slice(0, 9)
                .map(([k, v]) => (
                  <Field key={k} label={k} value={v} />
                ))}
            </dl>
          </Panel>
          <Panel title="従業員・人事データ">
            <dl>
              {Object.entries(basic)
                .slice(9, 18)
                .map(([k, v]) => (
                  <Field key={k} label={k} value={v} />
                ))}
            </dl>
          </Panel>
          <Panel title="制度・取引状況">
            <dl>
              {Object.entries(basic)
                .slice(18)
                .map(([k, v]) => (
                  <Field key={k} label={k} value={v} />
                ))}
            </dl>
          </Panel>
        </div>
      )}

      {/* Financial */}
      {tab === "financial" && (
        <div className="space-y-4">
          <Panel title="売上高・営業利益・従業員数の推移">
            <FinancialTrendChart data={financials} />
          </Panel>
          <Panel title="財務詳細" bodyClassName="p-0">
            {financials.length === 0 ? (
              <EmptyState message="財務データがありません。" />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>年度</th>
                    <th className="text-right">売上高</th>
                    <th className="text-right">営業利益</th>
                    <th className="text-right">営業利益率</th>
                    <th className="text-right">当期純利益</th>
                    <th className="text-right">総資産</th>
                    <th className="text-right">従業員数</th>
                    <th className="text-right">前年比</th>
                    <th className="text-right">平均年収</th>
                    <th className="text-right">福利厚生費比率</th>
                    <th className="text-right">離職率</th>
                  </tr>
                </thead>
                <tbody>
                  {financials.map((f) => (
                    <tr key={f.fiscalYear}>
                      <td className="font-medium">FY{f.fiscalYear}</td>
                      <td className="text-right tabular-nums">{formatJpy(f.revenue)}</td>
                      <td className="text-right tabular-nums">{formatJpy(f.operatingProfit)}</td>
                      <td className="text-right tabular-nums">
                        {f.revenue ? `${((f.operatingProfit / f.revenue) * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td className="text-right tabular-nums">{formatJpy(f.netProfit)}</td>
                      <td className="text-right tabular-nums">{formatJpy(f.totalAssets)}</td>
                      <td className="text-right tabular-nums">{formatNum(f.employeeCount)}</td>
                      <td className="text-right tabular-nums">
                        <span className={f.employeeCountYoy > 0 ? "text-emerald-600" : "text-slate-600"}>
                          {f.employeeCountYoy > 0 ? "+" : ""}
                          {f.employeeCountYoy}%
                        </span>
                      </td>
                      <td className="text-right tabular-nums">{formatJpy(f.averageSalary)}</td>
                      <td className="text-right tabular-nums">{f.welfareExpenseRatio}%</td>
                      <td className="text-right tabular-nums">{f.turnoverRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      )}

      {/* Jobs — the signal source */}
      {tab === "jobs" && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="求人件数・募集人数の推移">
              <JobPostingTrendChart data={jobs.byMonth} />
            </Panel>
            <Panel title="保険ニーズシグナル別の集計" bodyClassName="p-0">
              {jobs.bySignal.length === 0 ? (
                <EmptyState message="求人データがありません。" />
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>シグナル種別</th>
                      <th className="w-16 text-right">求人数</th>
                      <th className="w-16 text-right">募集人数</th>
                      <th className="w-20">強度</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.bySignal.map((s) => (
                      <tr key={s.signalType}>
                        <td>
                          <div className="font-medium">{s.signalType}</div>
                          <div className="text-[11px] leading-tight text-muted-foreground">
                            {s.rationale}
                          </div>
                        </td>
                        <td className="text-right tabular-nums">{s.postings}</td>
                        <td className="text-right tabular-nums">{formatNum(s.openings)}</td>
                        <td>
                          <SignalStrength value={s.maxStrength} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>
          <Panel title={`求人票 ${jobs.postings.length}件（シグナル強度順）`} bodyClassName="p-0">
            {jobs.postings.length === 0 ? (
              <EmptyState message="求人データがありません。" />
            ) : (
              <div className="max-h-[30rem] overflow-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-20">掲載日</th>
                      <th className="min-w-[14rem]">職種</th>
                      <th>部門</th>
                      <th className="w-14 text-right">募集</th>
                      <th className="w-24">想定年収</th>
                      <th className="w-24">シグナル</th>
                      <th className="w-20">強度</th>
                      <th className="w-24">掲載媒体</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.postings.map((p) => (
                      <tr key={p.postingId}>
                        <td className="whitespace-nowrap text-[12px] text-slate-600">
                          {p.postingDate}
                        </td>
                        <td>
                          <div className="font-medium">{p.jobTitle}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {p.workLocation}
                            {p.isOverseas && " ・海外"} / {p.employmentType}
                          </div>
                        </td>
                        <td className="text-[12px] text-slate-600">{p.department}</td>
                        <td className="text-right tabular-nums">{p.openings}</td>
                        <td className="text-[12px] tabular-nums text-slate-600">
                          {Math.round(p.salaryMin / 10000)}〜{Math.round(p.salaryMax / 10000)}万
                        </td>
                        <td className="text-[12px] font-medium">{p.signalType}</td>
                        <td>
                          <SignalStrength value={p.signalStrength} />
                        </td>
                        <td className="text-[12px] text-slate-500">{p.sourceSite}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* Contracts */}
      {tab === "contracts" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Panel title={`加入契約 ${contracts.contracts.length}件`} bodyClassName="p-0">
              {contracts.contracts.length === 0 ? (
                <EmptyState message="加入契約がありません（新規開拓先）。" />
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="min-w-[12rem]">商品</th>
                      <th>カテゴリ</th>
                      <th className="w-20 text-right">年間保険料</th>
                      <th className="w-20 text-right">被保険者</th>
                      <th className="w-20">満期日</th>
                      <th className="w-16 text-right">残日数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contracts.contracts.map((c) => (
                      <tr key={c.contractId}>
                        <td className="font-medium">{c.productName}</td>
                        <td className="text-[12px] text-slate-600">{c.productCategory}</td>
                        <td className="text-right tabular-nums">{formatJpy(c.annualPremium)}</td>
                        <td className="text-right tabular-nums">{formatNum(c.insuredCount)}</td>
                        <td className="whitespace-nowrap text-[12px]">{c.expiryDate}</td>
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
          </div>
          <Panel title="未加入カテゴリ（提案余地）">
            {contracts.gaps.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                主要カテゴリはすべて加入済みです。増口・条件見直しの提案余地を検討してください。
              </p>
            ) : (
              <ul className="space-y-2.5">
                {contracts.gaps.map((g) => (
                  <li key={g.category} className="border-b border-slate-100 pb-2 last:border-0">
                    <div className="text-xs font-semibold text-slate-900">{g.category}</div>
                    <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {g.products.slice(0, 4).join("、")}
                      {g.products.length > 4 && ` ほか${g.products.length - 4}件`}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {/* Contacts / SanSan */}
      {tab === "contacts" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="キーマンカバレッジ" bodyClassName="p-0">
            {contacts.contacts.length === 0 ? (
              <EmptyState message="登録されたキーマンがいません。名刺情報の登録から始めてください。" />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>氏名 / 役職</th>
                    <th className="w-16">区分</th>
                    <th className="w-14 text-right">接点数</th>
                    <th className="w-14 text-right">対面</th>
                    <th className="w-20 text-right">最終接触</th>
                    <th className="w-20">状態</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.contacts.map((c) => (
                    <tr key={c.contactId}>
                      <td>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {c.title} / {c.department}
                        </div>
                      </td>
                      <td className="text-[12px]">{ROLE_LABEL[c.role] ?? c.role}</td>
                      <td className="text-right tabular-nums">{c.touchpointCount}</td>
                      <td className="text-right tabular-nums">{c.faceToFaceCount}</td>
                      <td className="text-right text-[12px] text-slate-600">
                        {daysAgoLabel(c.daysSinceTouch)}
                      </td>
                      <td>
                        <span
                          className={cn(
                            "inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium",
                            COVERAGE_STYLE[c.coverageStatus] ?? COVERAGE_STYLE.接点浅い,
                          )}
                        >
                          {c.coverageStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
          <Panel title="接点履歴（SanSan連携）" bodyClassName="p-0">
            {contacts.touchpoints.length === 0 ? (
              <EmptyState message="接点履歴がありません。" />
            ) : (
              <ul className="max-h-[28rem] divide-y divide-border overflow-auto">
                {contacts.touchpoints.map((t) => (
                  <li key={t.touchpointId} className="px-3.5 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-medium text-slate-900">
                        {t.contactName}
                        <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                          {t.title}
                        </span>
                      </span>
                      <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                        {t.date}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700">
                        {t.type}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{t.channel}</span>
                      {t.sansanRegistered && (
                        <span className="rounded border border-sky-200 bg-sky-50 px-1 text-[10px] text-sky-700">
                          SanSan {t.sansanCardId}
                        </span>
                      )}
                      <SentimentBadge sentiment={t.sentiment} />
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{t.notes}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {/* News & alerts */}
      {tab === "news" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="事業イベントアラート" bodyClassName="p-0">
            {news.alerts.length === 0 ? (
              <EmptyState message="未処理のアラートはありません。" />
            ) : (
              <ul className="max-h-[30rem] divide-y divide-border overflow-auto">
                {news.alerts.map((a) => (
                  <li key={a.alertId} className="px-3.5 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-medium text-violet-800">
                        {a.eventType}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {a.detectedAt?.slice(0, 10)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-900">{a.summary}</p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-slate-600">{a.reason}</p>
                    {a.recommendedAction && (
                      <p className="mt-1 text-[12px] text-slate-700">
                        <span className="font-medium">推奨アクション: </span>
                        {a.recommendedAction}
                      </p>
                    )}
                    {a.recommendedProducts.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {a.recommendedProducts.map((p) => (
                          <span
                            key={p}
                            className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="ニュース" bodyClassName="p-0">
            {news.news.length === 0 ? (
              <EmptyState message="ニュースがありません。" />
            ) : (
              <ul className="max-h-[30rem] divide-y divide-border overflow-auto">
                {news.news.map((n) => (
                  <li key={n.newsId} className="px-3.5 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        {n.date} / {n.source}
                      </span>
                      {n.insuranceRelevance && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                          保険関連度 {n.insuranceRelevance}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs font-medium text-slate-900">{n.headline}</p>
                    <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-slate-600">
                      {n.body}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {/* Meetings */}
      {tab === "meetings" && (
        <Panel title={`商談履歴 ${meetings.length}件`} bodyClassName="p-0">
          {meetings.length === 0 ? (
            <EmptyState message="商談履歴がありません。" />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-20">商談日</th>
                  <th>議題</th>
                  <th className="w-16">形式</th>
                  <th className="w-20">結果</th>
                  <th className="w-16">反応</th>
                  <th className="w-14 text-right">品質</th>
                  <th className="w-14 text-right">質問数</th>
                  <th className="w-16 text-right">深層ニーズ</th>
                  <th className="w-16 text-right">未回収</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((m) => (
                  <tr key={m.meetingId}>
                    <td className="whitespace-nowrap text-[12px] text-slate-600">
                      {m.meetingDate}
                    </td>
                    <td>
                      <Link
                        href={href(`/meetings/${m.meetingId}`)}
                        className="font-medium hover:text-[var(--brand-primary)] hover:underline"
                      >
                        {m.agenda}
                      </Link>
                    </td>
                    <td className="text-[12px] text-slate-600">{m.meetingType}</td>
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
                    <td className="text-right tabular-nums">{m.hearingQuestionCount}</td>
                    <td className="text-right tabular-nums">{m.deepNeedCount}</td>
                    <td className="text-right tabular-nums">{m.missedCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      )}
    </div>
  )
}
