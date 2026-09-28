"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { GitCompareArrows, Loader2, Sparkles, TriangleAlert } from "lucide-react"
import type { MeetingDetail } from "@/lib/queries"
import { EmptyState, Panel, PriorityBadge, TierBadge } from "@/components/ui-kit"
import { cn } from "@/lib/utils"

interface DeepDive {
  metrics: {
    qualityScore: number
    hearingQuestionCount: number
    deepNeedCount: number
    missedCount: number
    objectionsHandled: number
    objectionCount: number
    topAvgQuality: number
    topAvgQuestions: number
    topAvgDeepNeeds: number
    topAvgMissed: number
  }
  refined_needs: {
    need: string
    current_depth: string
    target_depth: string
    why_it_matters: string
    probe_questions: string[]
  }[]
  gap_analysis: {
    dimension: string
    this_meeting: string
    top_performer: string
    advice: string
    knowledge_id?: string
  }[]
  missed_recovery: { missed: string; recovery_action: string; script: string }[]
  next_meeting_focus: string
}

const DEPTH_STYLE: Record<string, string> = {
  深層: "bg-emerald-100 text-emerald-800",
  中層: "bg-sky-100 text-sky-800",
  表層: "bg-slate-100 text-slate-700",
}

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

/** Metric row comparing this meeting against the top performer's average. */
function CompareRow({
  label,
  mine,
  top,
  higherIsBetter = true,
  unit = "",
}: {
  label: string
  mine: number
  top: number
  higherIsBetter?: boolean
  unit?: string
}) {
  const diff = mine - top
  const good = higherIsBetter ? diff >= 0 : diff <= 0
  const pct = top > 0 ? Math.min(100, (mine / top) * 100) : mine > 0 ? 100 : 0
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="text-slate-600">{label}</span>
        <span className="tabular-nums">
          <span className="font-semibold text-slate-900">
            {mine}
            {unit}
          </span>
          <span className="mx-1 text-slate-300">/</span>
          <span className="text-slate-500">
            トップ {top}
            {unit}
          </span>
          <span className={cn("ml-1.5 font-medium", good ? "text-emerald-600" : "text-rose-600")}>
            {diff > 0 ? "+" : ""}
            {Math.round(diff * 10) / 10}
          </span>
        </span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full", good ? "bg-emerald-500" : "bg-rose-400")}
          style={{ width: `${pct}%` }}
        />
        <div className="absolute inset-y-0 w-0.5 bg-slate-500" style={{ left: "100%" }} />
      </div>
    </div>
  )
}

type ReviewTab = "transcript" | "summary" | "review"

export function MeetingReview({
  detail,
  initialTab = "summary",
}: {
  detail: MeetingDetail
  initialTab?: ReviewTab
}) {
  const [tab, setTab] = useState<ReviewTab>(initialTab)
  const [deepDive, setDeepDive] = useState<DeepDive | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/needs-deepdive", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ meetingId: detail.meetingId }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "AI分析に失敗しました")
      return (await res.json()) as DeepDive
    },
    onSuccess: (d) => {
      setDeepDive(d)
      setTab("review")
    },
  })

  const top = detail.benchmark.find((b) => b.skillTier === "トップ")
  const s = detail.summary
  const isRepSpeaker = (label: string) => label.includes("スノー生命")

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-border">
        <div className="flex">
          {(
            [
              ["summary", "要約・ニーズ"],
              ["transcript", `書き起こし（${detail.turnCount}発言）`],
              ["review", "振り返り・トップ比較"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-selected={tab === id}
              role="tab"
              className={cn(
                "border-b-2 px-3.5 py-2.5 text-xs font-medium transition-colors",
                tab === id
                  ? "border-[var(--brand-primary)] text-[var(--brand-primary)]"
                  : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="mb-1.5 inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-primary)]
                     px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {mutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {mutation.isPending ? "分析中（30〜60秒）…" : "AIで課題・ニーズを精緻化"}
        </button>
      </div>

      {mutation.isError && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {(mutation.error as Error).message}
        </div>
      )}

      {/* Summary tab */}
      {tab === "summary" && (
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            <Panel title="商談要約">
              {s.text ? (
                <p className="text-xs leading-relaxed text-slate-700">{s.text}</p>
              ) : (
                <EmptyState message="要約がありません。" />
              )}
              {s.modelUsed && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  生成モデル: {s.modelUsed}
                </p>
              )}
            </Panel>

            <Panel title={`抽出された顧客ニーズ ${s.customerNeeds.length}件`} bodyClassName="p-0">
              {s.customerNeeds.length === 0 ? (
                <EmptyState message="ニーズが抽出されていません。" />
              ) : (
                <ul className="divide-y divide-border">
                  {s.customerNeeds.map((n, i) => (
                    <li key={i} className="px-4 py-2.5">
                      <div className="flex items-start gap-2">
                        <span
                          className={cn(
                            "mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium",
                            DEPTH_STYLE[n.depth] ?? DEPTH_STYLE.表層,
                          )}
                        >
                          {n.depth}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-slate-900">{n.need}</div>
                          {n.evidence && (
                            <p className="evidence-quote mt-1">{n.evidence}</p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <div className="grid gap-4 md:grid-cols-2">
              <Panel title={`顧客の懸念 ${s.objections.length}件`} bodyClassName="p-0">
                {s.objections.length === 0 ? (
                  <EmptyState message="懸念は記録されていません。" />
                ) : (
                  <ul className="divide-y divide-border">
                    {s.objections.map((o, i) => (
                      <li key={i} className="flex items-start gap-2 px-4 py-2">
                        <span
                          className={cn(
                            "mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium",
                            o.handled
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800",
                          )}
                        >
                          {o.handled ? "応対済" : "未応対"}
                        </span>
                        <span className="text-xs leading-relaxed text-slate-700">{o.objection}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel
                title={
                  <span className="inline-flex items-center gap-1.5">
                    <TriangleAlert className="h-4 w-4 text-amber-500" />
                    拾えなかった論点 {s.missedOpportunities.length}件
                  </span>
                }
                bodyClassName="p-0"
              >
                {s.missedOpportunities.length === 0 ? (
                  <EmptyState message="取りこぼしはありません。" />
                ) : (
                  <ul className="divide-y divide-border">
                    {s.missedOpportunities.map((m, i) => (
                      <li key={i} className="px-4 py-2 text-xs leading-relaxed text-slate-700">
                        {m}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </div>

          <div className="space-y-4">
            <Panel title="経営・人事課題">
              {s.keyIssues.length === 0 ? (
                <EmptyState message="課題が抽出されていません。" />
              ) : (
                <ul className="space-y-1.5">
                  {s.keyIssues.map((k, i) => (
                    <li key={i} className="flex gap-1.5 text-xs leading-relaxed text-slate-700">
                      <span className="text-[var(--brand-primary)]">・</span>
                      <span>{k}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title={`ネクストアクション ${detail.actions.length}件`} bodyClassName="p-0">
              {detail.actions.length === 0 ? (
                <EmptyState message="アクションが登録されていません。" />
              ) : (
                <ul className="divide-y divide-border">
                  {detail.actions.map((a) => (
                    <li key={a.actionId} className="px-4 py-2.5">
                      <div className="flex items-start gap-2">
                        <PriorityBadge priority={a.priority} />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-slate-900">{a.title}</div>
                          {a.detail && (
                            <p className="mt-0.5 text-[12px] leading-relaxed text-slate-600">
                              {a.detail}
                            </p>
                          )}
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span>期限 {a.dueDate ?? "—"}</span>
                            <span
                              className={cn(
                                "rounded px-1 py-0.5 font-medium",
                                a.status === "遅延"
                                  ? "bg-rose-100 text-rose-700"
                                  : a.status === "完了"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-slate-100 text-slate-600",
                              )}
                            >
                              {a.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {s.complianceIssues.length > 0 && (
              <Panel
                title={
                  <span className="inline-flex items-center gap-1.5 text-rose-700">
                    <TriangleAlert className="h-4 w-4" />
                    コンプライアンス指摘
                  </span>
                }
              >
                <ul className="space-y-1.5">
                  {s.complianceIssues.map((c, i) => (
                    <li key={i} className="text-xs leading-relaxed text-rose-700">
                      ・{c}
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        </div>
      )}

      {/* Transcript tab */}
      {tab === "transcript" && (
        <Panel title={`書き起こし（${detail.turnCount}発言）`} bodyClassName="p-0">
          {detail.transcript.length === 0 ? (
            <EmptyState message="書き起こしがありません。" />
          ) : (
            <ul className="divide-y divide-border">
              {detail.transcript.map((t) => {
                const isRep = isRepSpeaker(t.speaker)
                return (
                  <li
                    key={t.transcriptId}
                    className={cn("flex gap-3 px-4 py-2.5", isRep ? "bg-sky-50/40" : undefined)}
                  >
                    <div className="w-14 shrink-0 pt-0.5 font-mono text-[11px] text-muted-foreground">
                      {fmtTime(t.startSec)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "text-[12px] font-semibold",
                          isRep ? "text-[var(--brand-primary)]" : "text-slate-700",
                        )}
                      >
                        {t.speaker}
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-800">{t.text}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      )}

      {/* Review tab */}
      {tab === "review" && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title={
                <span className="inline-flex items-center gap-1.5">
                  <GitCompareArrows className="h-4 w-4 text-[var(--brand-primary)]" />
                  トップ営業との実績比較
                </span>
              }
            >
              <div className="space-y-3">
                <CompareRow
                  label="商談品質スコア"
                  mine={detail.qualityScore}
                  top={top?.avgQuality ?? 0}
                />
                <CompareRow
                  label="ヒアリング質問数"
                  mine={detail.hearingQuestionCount}
                  top={top?.avgQuestions ?? 0}
                  unit="回"
                />
                <CompareRow
                  label="深層ニーズの抽出数"
                  mine={detail.deepNeedCount}
                  top={top?.avgDeepNeeds ?? 0}
                  unit="件"
                />
                <CompareRow
                  label="拾えなかった論点"
                  mine={detail.missedCount}
                  top={top?.avgMissed ?? 0}
                  higherIsBetter={false}
                  unit="件"
                />
                <div className="border-t border-slate-100 pt-2 text-[12px] text-muted-foreground">
                  基準線はトップ営業（山田 太郎・成約率68%）の平均値です。
                </div>
              </div>
            </Panel>

            <Panel title="次回商談で最も注力すべき点">
              {deepDive ? (
                <p className="text-xs leading-relaxed text-slate-800">
                  {deepDive.next_meeting_focus}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  「AIで課題・ニーズを精緻化」を実行すると、この商談の書き起こしとトップ営業の暗黙知を突き合わせた具体的な改善提案が表示されます。
                </p>
              )}
            </Panel>
          </div>

          {deepDive && (
            <>
              <Panel title={`トップ営業との差分分析 ${deepDive.gap_analysis.length}件`} bodyClassName="p-0">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-32">観点</th>
                      <th>この商談</th>
                      <th>トップ営業なら</th>
                      <th className="min-w-[14rem]">改善アクション</th>
                      <th className="w-20">根拠</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deepDive.gap_analysis.map((g, i) => (
                      <tr key={i}>
                        <td className="font-medium">{g.dimension}</td>
                        <td className="text-[12px] leading-relaxed text-rose-700">{g.this_meeting}</td>
                        <td className="text-[12px] leading-relaxed text-emerald-700">
                          {g.top_performer}
                        </td>
                        <td className="text-[12px] leading-relaxed text-slate-700">{g.advice}</td>
                        <td className="font-mono text-[11px] text-muted-foreground">
                          {g.knowledge_id || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title={`精緻化された顧客ニーズ ${deepDive.refined_needs.length}件`} bodyClassName="p-0">
                  <ul className="divide-y divide-border">
                    {deepDive.refined_needs.map((n, i) => (
                      <li key={i} className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[11px] font-medium",
                              DEPTH_STYLE[n.current_depth] ?? DEPTH_STYLE.表層,
                            )}
                          >
                            現在: {n.current_depth}
                          </span>
                          <span className="text-[11px] text-slate-400">→</span>
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[11px] font-medium",
                              DEPTH_STYLE[n.target_depth] ?? DEPTH_STYLE.中層,
                            )}
                          >
                            目標: {n.target_depth}
                          </span>
                        </div>
                        <div className="mt-1 text-xs font-medium text-slate-900">{n.need}</div>
                        <p className="mt-0.5 text-[12px] leading-relaxed text-slate-600">
                          {n.why_it_matters}
                        </p>
                        {n.probe_questions.length > 0 && (
                          <div className="mt-1.5">
                            <div className="metric-label">次回投げる深掘り質問</div>
                            <ul className="mt-0.5 space-y-1">
                              {n.probe_questions.map((q, j) => (
                                <li key={j} className="evidence-quote not-italic">
                                  {q}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </Panel>

                <Panel title={`取りこぼしの回収策 ${deepDive.missed_recovery.length}件`} bodyClassName="p-0">
                  <ul className="divide-y divide-border">
                    {deepDive.missed_recovery.map((m, i) => (
                      <li key={i} className="px-4 py-3">
                        <div className="text-xs font-medium text-amber-700">{m.missed}</div>
                        <p className="mt-0.5 text-[12px] leading-relaxed text-slate-600">
                          {m.recovery_action}
                        </p>
                        <p className="evidence-quote mt-1.5 not-italic">{m.script}</p>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
