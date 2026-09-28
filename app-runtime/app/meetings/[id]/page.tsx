import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Sparkles } from "lucide-react"
import { getMeetingDetail } from "@/lib/queries"
import { formatNum } from "@/lib/format"
import { KpiCard, OutcomeBadge, SentimentBadge, TierBadge } from "@/components/ui-kit"
import { MeetingReview } from "@/components/meeting-review"

export const dynamic = "force-dynamic"

export default async function MeetingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ rep?: string; stage?: string; sort?: string }>
}) {
  const { id } = await params
  const { rep, stage, sort } = await searchParams
  const isReview = stage === "review"

  const detail = await getMeetingDetail(id)
  if (!detail) notFound()

  const href = (p: string) => {
    const [path, existing] = p.split("?")
    const q = new URLSearchParams(existing ?? "")
    if (rep) q.set("rep", rep)
    if (isReview) q.set("stage", "review")
    // 一覧の並び順を戻しリンクに引き継ぐ。さもないと日付昇順で見ていても
    // 戻った瞬間に既定順にリセットされてしまう。
    if (sort) q.set("sort", sort)
    const qs = q.toString()
    return qs ? `${path}?${qs}` : path
  }
  const top = detail.benchmark.find((b) => b.skillTier === "トップ")

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <Link
            href={href("/meetings")}
            className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-slate-900"
          >
            <ArrowLeft className="h-3 w-3" />
            {isReview ? "振り返り一覧に戻る" : "商談一覧に戻る"}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">
              <Link
                href={href(`/customers/${detail.companyId}`)}
                className="hover:text-[var(--brand-primary)] hover:underline"
              >
                {detail.companyName}
              </Link>
            </h1>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[12px] font-medium text-slate-700">
              {detail.agenda}
            </span>
            <OutcomeBadge outcome={detail.outcome} />
            <SentimentBadge sentiment={detail.summary.sentiment || null} />
          </div>
          <p className="text-xs text-muted-foreground">
            {detail.meetingDate} / {detail.meetingType} / {detail.durationMinutes}分 /{" "}
            <span className="inline-flex items-center gap-1">
              {detail.salesRepName}
              <TierBadge tier={detail.skillTier} />
            </span>{" "}
            / {detail.industryDetail}・従業員 {formatNum(detail.employeeCount)}名
          </p>
        </div>
        <Link
          href={href(`/proposals/${detail.companyId}`)}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2
                     text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Sparkles className="h-3.5 w-3.5" />
          提案ストーリー・提案書へ
        </Link>
      </div>

      {/* Metric strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="商談品質スコア"
          value={`${detail.qualityScore}`}
          tone={
            detail.qualityScore >= 60 ? "good" : detail.qualityScore >= 35 ? "warn" : "danger"
          }
          sub={top ? `トップ平均 ${top.avgQuality}` : undefined}
        />
        <KpiCard
          label="ヒアリング質問数"
          value={`${detail.hearingQuestionCount}回`}
          tone={
            top && detail.hearingQuestionCount >= top.avgQuestions
              ? "good"
              : detail.hearingQuestionCount <= 1
                ? "danger"
                : "warn"
          }
          sub={top ? `トップ平均 ${top.avgQuestions}回` : undefined}
        />
        <KpiCard
          label="深層ニーズ抽出"
          value={`${detail.deepNeedCount}件`}
          sub={top ? `トップ平均 ${top.avgDeepNeeds}件` : undefined}
        />
        <KpiCard
          label="拾えなかった論点"
          value={`${detail.missedCount}件`}
          tone={detail.missedCount >= 4 ? "warn" : "default"}
          sub={top ? `トップ平均 ${top.avgMissed}件` : undefined}
        />
        <KpiCard
          label="懸念への応対"
          value={`${detail.objectionsHandled}/${detail.summary.objections.length}`}
          tone={
            detail.summary.objections.length === 0
              ? "default"
              : detail.objectionsHandled === detail.summary.objections.length
                ? "good"
                : "warn"
          }
          sub="適切に応対できた件数"
        />
        <KpiCard
          label="次回アクション合意"
          value={detail.nextActionAgreed ? "あり" : "なし"}
          tone={detail.nextActionAgreed ? "good" : "danger"}
          sub={`発言数 ${detail.turnCount}`}
        />
      </div>

      <MeetingReview detail={detail} initialTab={isReview ? "review" : "summary"} />
    </div>
  )
}
