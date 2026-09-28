import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, FileText, Sparkles } from "lucide-react"
import {
  getCustomerContacts,
  getCustomerContracts,
  getCustomerFinancials,
  getCustomerJobPostings,
  getCustomerNews,
  getCustomerOverview,
  getMeetings,
} from "@/lib/queries"
import { daysAgoLabel, formatJpy, formatNum } from "@/lib/format"
import { GradeBadge, KpiCard, Panel, ScoreBar, TriggerBadge } from "@/components/ui-kit"
import { CustomerTabs } from "@/components/customer-tabs"

export const dynamic = "force-dynamic"

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ rep?: string }>
}) {
  const { id } = await params
  const { rep } = await searchParams

  const overview = await getCustomerOverview(id)
  if (!overview) notFound()

  const [financials, jobs, contacts, contracts, news, meetings] = await Promise.all([
    getCustomerFinancials(id),
    getCustomerJobPostings(id),
    getCustomerContacts(id),
    getCustomerContracts(id),
    getCustomerNews(id),
    getMeetings(null, id),
  ])

  const o = overview
  const href = (p: string) =>
    rep ? `${p}${p.includes("?") ? "&" : "?"}rep=${encodeURIComponent(rep)}` : p

  const basic: Record<string, React.ReactNode> = {
    企業名: o.companyName,
    "企業名（カナ）": o.companyNameKana || "—",
    業種: `${o.industryLarge} / ${o.industryDetail}`,
    本社所在地: `${o.headquarters}（${o.prefecture}）`,
    設立年: o.foundedYear ? `${o.foundedYear}年` : "—",
    上場市場: o.isListed ? `${o.stockMarket}（${o.stockTicker}）` : "非上場",
    格付: o.creditRating || "—",
    売上高: formatJpy(o.annualRevenue),
    海外子会社: o.hasOverseas ? "あり" : "なし",

    従業員数: `${formatNum(o.employeeCount)}名`,
    国内従業員数: `${formatNum(o.employeeCountJapan)}名`,
    海外従業員数: `${formatNum(o.employeeCountOverseas)}名`,
    平均年齢: `${o.averageAge}歳`,
    平均年収: formatJpy(o.averageSalary),
    定着率: `${o.retentionRate}%`,
    離職率: `${o.turnoverRate}%`,
    福利厚生費比率: `${o.welfareExpenseRatio}%`,
    従業員数前年比: `${o.employeeCountYoy > 0 ? "+" : ""}${o.employeeCountYoy}%`,

    年金制度: o.pensionType,
    健康経営認定: o.healthCertStatus,
    加入カテゴリ: o.coveredCategories.length ? o.coveredCategories.join("、") : "なし",
    見込みランク: o.prospectRank,
    担当営業: `${o.salesRepName}（${o.repSkillTier}）`,
    担当年数: o.yearsInCharge ? `${o.yearsInCharge}年` : "—",
    契約件数: `${o.contractCount}件`,
    年間保険料: formatJpy(o.totalPremium),
    被保険者数: `${formatNum(o.totalInsured)}名`,
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <Link
            href={href("/customers")}
            className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-slate-900"
          >
            <ArrowLeft className="h-3 w-3" />
            顧客一覧に戻る
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <GradeBadge grade={o.attack.grade} className="h-6 w-6 text-xs" />
            <h1 className="text-lg font-semibold tracking-tight">{o.companyName}</h1>
            <span className="text-xs text-muted-foreground">
              {o.industryDetail} / 従業員 {formatNum(o.employeeCount)}名 / 担当 {o.salesRepName}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {o.attack.triggers.map((t) => (
              <TriggerBadge key={t} trigger={t} />
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={href(`/proposals/${o.companyId}`)}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-primary)] px-3 py-2
                       text-xs font-medium text-white hover:opacity-90"
          >
            <Sparkles className="h-3.5 w-3.5" />
            提案ストーリーを作る
          </Link>
          <Link
            href={href(`/meetings?company=${o.companyId}`)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2
                       text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <FileText className="h-3.5 w-3.5" />
            商談履歴
          </Link>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="アタック総合スコア"
          value={`${o.attack.totalScore}`}
          sub={`主トリガー: ${o.attack.primaryTrigger}`}
          tone={o.attack.totalScore >= 75 ? "danger" : o.attack.totalScore >= 65 ? "warn" : "default"}
        />
        <KpiCard
          label="求人（直近90日）"
          value={`${o.recentPostings90d}件`}
          sub={`シグナル ${o.signalTypes.length}種 / 総募集 ${formatNum(o.totalOpenings)}名`}
        />
        <KpiCard
          label="年間保険料"
          value={formatJpy(o.totalPremium)}
          sub={`${o.contractCount}件 / 被保険者 ${formatNum(o.totalInsured)}名`}
        />
        <KpiCard
          label="90日以内満期"
          value={`${o.expiring90d}件`}
          tone={o.expiring90d > 0 ? "danger" : "default"}
          sub={o.nearestExpiry ? `最短 ${o.nearestExpiry}` : "該当なし"}
        />
        <KpiCard
          label="最終接触"
          value={daysAgoLabel(o.daysSinceTouch)}
          tone={o.daysSinceTouch > 150 ? "warn" : "default"}
          sub={`接点 ${o.touchpointCount}回 / キーマン ${o.contactedPeople}名`}
        />
        <KpiCard
          label="商談品質スコア"
          value={o.avgMeetingQuality ? `${o.avgMeetingQuality}` : "—"}
          tone={
            o.avgMeetingQuality >= 60 ? "good" : o.avgMeetingQuality >= 35 ? "warn" : "danger"
          }
          sub={`商談 ${o.meetingCount}回 / 成約 ${o.wonMeetings} / 停滞 ${o.stalledMeetings}`}
        />
      </div>

      {/* Preparation panel — stage 2 of the workflow */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="アタックスコア内訳">
          <div className="space-y-2">
            <ScoreBar label="求人シグナル" value={o.attack.scores.hiring} weight={0.28} />
            <ScoreBar label="契約空白" value={o.attack.scores.contractGap} weight={0.18} />
            <ScoreBar label="満期接近" value={o.attack.scores.renewal} weight={0.14} />
            <ScoreBar label="イベント鮮度" value={o.attack.scores.eventFresh} weight={0.14} />
            <ScoreBar label="接点空白" value={o.attack.scores.contactGap} weight={0.12} />
            <ScoreBar label="財務健全性" value={o.attack.scores.financial} weight={0.08} />
            <ScoreBar label="従業員規模" value={o.attack.scores.scale} weight={0.06} />
          </div>
        </Panel>

        <Panel title="今アプローチすべき理由">
          <div className="space-y-3 text-xs">
            {o.attack.topSignalType && (
              <div>
                <div className="metric-label">最も強い求人シグナル</div>
                <div className="mt-0.5 font-medium text-slate-900">
                  {o.attack.topSignalType}
                  {o.attack.topJobTitle && `：${o.attack.topJobTitle}`}
                </div>
                {o.attack.topSignalRationale && (
                  <p className="mt-1 leading-relaxed text-slate-600">
                    {o.attack.topSignalRationale}
                  </p>
                )}
              </div>
            )}
            <div className="border-t border-slate-100 pt-2">
              <div className="metric-label">検出されたトリガー</div>
              <ul className="mt-1 space-y-1 text-[12px] text-slate-600">
                {o.expiring90d > 0 && (
                  <li>・90日以内に満期を迎える契約が {o.expiring90d}件（最短 {o.nearestExpiry}）</li>
                )}
                {o.attack.scores.contactGap >= 40 && (
                  <li>
                    ・最終接触から {o.daysSinceTouch}日が経過。
                    {o.contactedPeople === 0 ? "キーマンとの接点がありません。" : ""}
                  </li>
                )}
                {o.attack.scores.contractGap >= 60 && (
                  <li>・未加入カテゴリが多く、クロスセルの余地が大きい</li>
                )}
                {o.openAlertCount > 0 && (
                  <li>・未処理の事業イベントアラートが {o.openAlertCount}件</li>
                )}
                {o.healthCertStatus === "なし" && (
                  <li>・健康経営認定が未取得。健康経営支援サービスの提案余地</li>
                )}
                {o.pensionType === "DB" && <li>・確定給付年金のみ。DC移行提案のタイミング</li>}
              </ul>
            </div>
          </div>
        </Panel>

        <Panel title="次アクションと見込み">
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="metric-label">見込み金額</div>
                <div className="mt-0.5 text-base font-semibold tabular-nums">
                  {formatJpy(o.pipelineAmount)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  案件 {o.prospectCount}件 / AIスコア {o.maxAiScore}
                </div>
              </div>
              <div>
                <div className="metric-label">未着手アクション</div>
                <div className="mt-0.5 text-base font-semibold tabular-nums">
                  {o.openActions}件
                </div>
                <div className="text-[11px] text-muted-foreground">
                  遅延 {o.overdueActions}件 / 次期限 {o.nextDueDate ?? "—"}
                </div>
              </div>
            </div>
            <div className="border-t border-slate-100 pt-2">
              <div className="metric-label">直近の動き</div>
              <ul className="mt-1 space-y-0.5 text-[12px] text-slate-600">
                <li>・最終商談: {o.lastMeetingDate ?? "—"}（{daysAgoLabel(o.daysSinceMeeting)}）</li>
                <li>・最終接触: {o.lastTouchDate ?? "—"}（{daysAgoLabel(o.daysSinceTouch)}）</li>
                <li>・最新求人: {o.latestPostingDate ?? "—"}</li>
                <li>・直近90日のニュース: {o.newsCount90d}件</li>
              </ul>
            </div>
          </div>
        </Panel>
      </div>

      {/* Detail tabs */}
      <CustomerTabs
        basic={basic}
        financials={financials}
        jobs={jobs}
        contacts={contacts}
        contracts={contracts}
        news={news}
        meetings={meetings}
        repParam={rep ?? ""}
      />
    </div>
  )
}
