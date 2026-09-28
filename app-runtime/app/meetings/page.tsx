import Link from "next/link"
import { getMeetings, getSalesReps } from "@/lib/queries"
import { EmptyState, OutcomeBadge, Panel, SentimentBadge, TierBadge } from "@/components/ui-kit"

export const dynamic = "force-dynamic"

/** 商談日の昇順・降順と、振り返り優先度順の3択。URL の `sort` に対応する。 */
type SortKey = "date_desc" | "date_asc" | "priority"

function qualityCell(score: number) {
  const cls =
    score >= 60
      ? "font-semibold text-emerald-600"
      : score >= 35
        ? "font-medium text-amber-600"
        : "font-medium text-rose-600"
  return <span className={cls}>{score}</span>
}

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ rep?: string; company?: string; stage?: string; sort?: SortKey }>
}) {
  const { rep, company, stage, sort } = await searchParams
  const isReview = stage === "review"
  const [rawMeetings, reps] = await Promise.all([
    getMeetings(rep ?? null, company ?? null),
    getSalesReps(),
  ])
  const activeRep = reps.find((r) => r.repId === rep)

  /**
   * 並び順は URL の `sort` で持つ。既定は振り返りなら優先度順、通常なら商談日の新しい順。
   * 担当者・企業絞り込み・ステージと同じクエリパラメータ方式に揃えることで、
   * 担当者を切り替えても並び順が保持される。
   */
  const activeSort: SortKey =
    sort === "date_asc" || sort === "date_desc" || sort === "priority"
      ? sort
      : isReview
        ? "priority"
        : "date_desc"

  const href = (p: string) => {
    const [path, existing] = p.split("?")
    const q = new URLSearchParams(existing ?? "")
    if (rep) q.set("rep", rep)
    if (isReview) q.set("stage", "review")
    // 既定の並び順のときは URL を汚さない
    if (activeSort !== (isReview ? "priority" : "date_desc")) q.set("sort", activeSort)
    const qs = q.toString()
    return qs ? `${path}?${qs}` : path
  }

  /**
   * 一覧ページ自身の URL を組み立てる。並び順の切替と企業絞り込みの解除で
   * 必要なパラメータが違うだけなので、引数で上書きできるようにする。
   */
  const listHref = (o: { sort?: SortKey; company?: string | null } = {}) => {
    const nextSort = o.sort ?? activeSort
    const nextCompany = o.company === undefined ? company : o.company
    const q = new URLSearchParams()
    if (rep) q.set("rep", rep)
    if (nextCompany) q.set("company", nextCompany)
    if (isReview) q.set("stage", "review")
    if (nextSort !== (isReview ? "priority" : "date_desc")) q.set("sort", nextSort)
    const qs = q.toString()
    return qs ? `/meetings?${qs}` : "/meetings"
  }

  /**
   * 振り返りモードの既定は「振り返りが必要な商談」を上に出す。品質が低い / 次回アクション
   * 未合意 / 拾えなかった論点が多い商談ほど優先。
   */
  const needsReview = (m: (typeof rawMeetings)[number]) =>
    m.qualityScore < 35 || !m.nextActionAgreed || m.missedCount >= 4

  /**
   * MEETING_DATE は NULL を許容するため、日付なしの商談は昇順・降順のどちらでも末尾に置く。
   * 空文字で比較すると昇順で先頭に来てしまい、実データの並びが読みにくくなる。
   * dir=1 で昇順（古い順）、dir=-1 で降順（新しい順）。
   */
  const byDate = (a: string | null, b: string | null, dir: 1 | -1) => {
    if (a === b) return 0
    if (!a) return 1
    if (!b) return -1
    return a < b ? -dir : dir
  }

  const meetings =
    activeSort === "priority"
      ? [...rawMeetings].sort(
          (a, b) =>
            Number(needsReview(b)) - Number(needsReview(a)) ||
            a.qualityScore - b.qualityScore ||
            b.missedCount - a.missedCount,
        )
      : [...rawMeetings].sort((a, b) =>
          byDate(a.meetingDate, b.meetingDate, activeSort === "date_asc" ? 1 : -1),
        )

  const stats = {
    total: meetings.length,
    avgQuality: meetings.length
      ? Math.round((meetings.reduce((s, m) => s + m.qualityScore, 0) / meetings.length) * 10) / 10
      : 0,
    won: meetings.filter((m) => m.outcome === "成約").length,
    stalled: meetings.filter((m) => m.outcome === "停滞").length,
    withCompliance: meetings.filter((m) => m.complianceIssueCount > 0).length,
    toReview: meetings.filter(needsReview).length,
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            {isReview ? "振り返り" : "商談・振り返り"}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isReview ? (
              <span>
                {activeSort === "priority"
                  ? "振り返りが必要な商談を優先表示しています（"
                  : "商談日順で表示しています（振り返り対象 "}
                <span className="font-semibold text-rose-600">{stats.toReview}件</span>
                ／全{stats.total}件）。商談を選ぶとトップ営業との差分分析と課題・ニーズ精緻化が開きます。
              </span>
            ) : activeRep ? (
              <span className="inline-flex items-center gap-1.5">
                {activeRep.name}
                <TierBadge tier={activeRep.skillTier} />
                の商談 {stats.total}件（{activeSort === "date_asc" ? "商談日 古い順" : "商談日 新しい順"}）
              </span>
            ) : (
              `全商談 ${stats.total}件（${activeSort === "date_asc" ? "商談日 古い順" : "商談日 新しい順"}）。商談を選ぶと書き起こし・要約・トップ営業との差分比較が表示されます。`
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-[12px] text-muted-foreground">
          <span>
            平均品質 <span className="font-semibold text-slate-900">{stats.avgQuality}</span>
          </span>
          <span>
            成約 <span className="font-semibold text-emerald-600">{stats.won}</span>
          </span>
          <span>
            停滞 <span className="font-semibold text-rose-600">{stats.stalled}</span>
          </span>
          {stats.withCompliance > 0 && (
            <span>
              コンプライアンス指摘{" "}
              <span className="font-semibold text-amber-600">{stats.withCompliance}</span>
            </span>
          )}
        </div>
      </div>

      <Panel
        title={
          isReview
            ? company
              ? "振り返り対象（企業絞り込み中）"
              : "振り返り対象の商談"
            : company
              ? `商談履歴（企業絞り込み中）`
              : "商談一覧"
        }
        actions={
          <div className="flex items-center gap-3">
            {isReview && (
              <Link
                href={listHref({ sort: "priority" })}
                className={
                  activeSort === "priority"
                    ? "text-[12px] font-semibold text-[var(--brand-primary)]"
                    : "text-[12px] text-muted-foreground hover:text-[var(--brand-primary)] hover:underline"
                }
              >
                優先度順
              </Link>
            )}
            {company && (
              <Link
                href={listHref({ company: null })}
                className="text-[12px] text-[var(--brand-primary)] hover:underline"
              >
                絞り込みを解除
              </Link>
            )}
          </div>
        }
        bodyClassName="p-0"
      >
        {meetings.length === 0 ? (
          <EmptyState message="商談履歴がありません。" />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-24">
                    {/*
                      商談日はクリックで昇順・降順を切り替える。既に日付ソート中なら逆順へ、
                      優先度順のときはまず新しい順に入るのが自然な導線。
                    */}
                    <Link
                      href={listHref({ sort: activeSort === "date_desc" ? "date_asc" : "date_desc" })}
                      className="inline-flex items-center gap-0.5 hover:text-[var(--brand-primary)]"
                      title="商談日で並び替え"
                    >
                      商談日
                      <span
                        className={
                          activeSort === "priority"
                            ? "text-slate-300"
                            : "text-[var(--brand-primary)]"
                        }
                      >
                        {activeSort === "date_asc" ? "↑" : "↓"}
                      </span>
                    </Link>
                  </th>
                  <th className="min-w-[12rem]">企業名</th>
                  <th className="min-w-[8rem]">議題</th>
                  <th className="w-16">形式</th>
                  {!rep && <th className="w-24">担当</th>}
                  <th className="w-20">結果</th>
                  <th className="w-16">反応</th>
                  <th className="w-14 text-right">品質</th>
                  <th className="w-14 text-right">質問数</th>
                  <th className="w-16 text-right">深層<br />ニーズ</th>
                  <th className="w-14 text-right">未回収</th>
                  <th className="w-14 text-right">発言数</th>
                  <th className="w-16 text-center">次回<br />合意</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((m) => (
                  <tr
                    key={m.meetingId}
                    className={isReview && needsReview(m) ? "bg-rose-50/40" : undefined}
                  >
                    <td className="whitespace-nowrap text-[12px] text-slate-600">{m.meetingDate}</td>
                    <td>
                      <Link
                        href={href(`/meetings/${m.meetingId}`)}
                        className="font-medium text-slate-900 hover:text-[var(--brand-primary)] hover:underline"
                      >
                        {m.companyName}
                      </Link>
                    </td>
                    <td className="text-[12px] text-slate-600">{m.agenda}</td>
                    <td className="text-[12px] text-slate-600">{m.meetingType}</td>
                    {!rep && (
                      <td className="text-[12px]">
                        <span className="inline-flex items-center gap-1">
                          {m.salesRepName}
                          <TierBadge tier={m.skillTier} />
                        </span>
                      </td>
                    )}
                    <td>
                      <OutcomeBadge outcome={m.outcome} />
                    </td>
                    <td>
                      <SentimentBadge sentiment={m.sentiment} />
                    </td>
                    <td className="text-right">{qualityCell(m.qualityScore)}</td>
                    <td className="text-right tabular-nums">{m.hearingQuestionCount}</td>
                    <td className="text-right tabular-nums">{m.deepNeedCount}</td>
                    <td className="text-right tabular-nums">
                      <span className={m.missedCount >= 4 ? "text-amber-600" : undefined}>
                        {m.missedCount}
                      </span>
                    </td>
                    <td className="text-right tabular-nums text-slate-500">{m.turnCount}</td>
                    <td className="text-center">
                      {m.nextActionAgreed ? (
                        <span className="text-emerald-600">✓</span>
                      ) : (
                        <span className="text-rose-500">✕</span>
                      )}
                    </td>
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
