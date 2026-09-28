"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ClipboardCheck,
  Download,
  FileText,
  Lightbulb,
  Loader2,
  MessageSquareQuote,
  Sparkles,
} from "lucide-react"
import type { CustomerOverview, Proposal, ProposalStory } from "@/lib/queries"
import { formatJpy, formatNum } from "@/lib/format"
import { EmptyState, Panel, TriggerBadge } from "@/components/ui-kit"
import { cn } from "@/lib/utils"

/** Build a Markdown document from a saved proposal so the rep can export it. */
function proposalToMarkdown(p: Proposal, companyName: string): string {
  const lines: string[] = [`# ${p.title || `${companyName} 様 ご提案`}`, ""]
  if (p.executiveSummary) lines.push("## エグゼクティブサマリー", "", p.executiveSummary, "")
  for (const s of p.sections) {
    lines.push(`## ${s.heading}`, "", s.body, "")
    if (s.evidence?.length) {
      lines.push("**根拠データ**", "")
      for (const e of s.evidence) lines.push(`- ${e}`)
      lines.push("")
    }
  }
  if (p.recommendedProducts.length) {
    lines.push("## 推奨商品", "", "| 商品 | 推奨理由 | 想定年間保険料 |", "| --- | --- | --- |")
    for (const r of p.recommendedProducts) {
      lines.push(
        `| ${r.product} | ${r.reason} | ${r.estimatedPremium ? formatJpy(r.estimatedPremium) : "—"} |`,
      )
    }
    lines.push("", `**想定年間保険料合計: ${formatJpy(p.estimatedPremium)}**`, "")
  }
  lines.push("---", "", `作成: スノー生命 法人営業部 / 生成モデル: ${p.modelUsed}`, "", "※本提案書はデモ用の架空データに基づくドラフトです。")
  return lines.join("\n")
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ProposalWorkspace({
  overview,
  initialStories,
  initialProposals,
  repParam,
}: {
  overview: CustomerOverview
  initialStories: ProposalStory[]
  initialProposals: Proposal[]
  repParam: string
}) {
  const qc = useQueryClient()
  const companyId = overview.companyId
  const [selectedStory, setSelectedStory] = useState<string | null>(
    initialStories[0]?.storyId ?? null,
  )
  const [copied, setCopied] = useState(false)

  const { data: stories = initialStories } = useQuery<ProposalStory[]>({
    queryKey: ["stories", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/ai/proposal-story?company=${companyId}`)
      if (!res.ok) throw new Error("提案ストーリーの取得に失敗しました")
      return res.json()
    },
    initialData: initialStories,
  })

  const { data: proposals = initialProposals } = useQuery<Proposal[]>({
    queryKey: ["proposals", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/ai/proposal?company=${companyId}`)
      if (!res.ok) throw new Error("提案書の取得に失敗しました")
      return res.json()
    },
    initialData: initialProposals,
  })

  const storyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/proposal-story", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companyId, repId: repParam || undefined }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "生成に失敗しました")
      return (await res.json()) as ProposalStory
    },
    onSuccess: (s) => {
      setSelectedStory(s.storyId)
      qc.invalidateQueries({ queryKey: ["stories", companyId] })
    },
  })

  const proposalMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/proposal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          companyId,
          storyId: selectedStory ?? undefined,
          repId: repParam || undefined,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "生成に失敗しました")
      return (await res.json()) as Proposal
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proposals", companyId] }),
  })

  const story = stories.find((s) => s.storyId === selectedStory) ?? stories[0]
  const proposal = proposals[0]

  return (
    <div className="space-y-4">
      {/* Context strip — what the generation is grounded in */}
      <Panel title="生成の根拠となるデータ">
        <div className="grid gap-4 text-xs md:grid-cols-4">
          <div>
            <div className="metric-label">企業属性</div>
            <ul className="mt-1 space-y-0.5 text-[12px] text-slate-600">
              <li>従業員 {formatNum(overview.employeeCount)}名（海外 {formatNum(overview.employeeCountOverseas)}名）</li>
              <li>平均年齢 {overview.averageAge}歳 / 離職率 {overview.turnoverRate}%</li>
              <li>年金制度 {overview.pensionType}</li>
              <li>健康経営 {overview.healthCertStatus}</li>
            </ul>
          </div>
          <div>
            <div className="metric-label">求人シグナル</div>
            <ul className="mt-1 space-y-0.5 text-[12px] text-slate-600">
              <li>直近90日 {overview.recentPostings90d}件</li>
              <li>総募集 {formatNum(overview.totalOpenings)}名</li>
              <li className="leading-relaxed">
                {overview.signalTypes.length ? overview.signalTypes.join("、") : "検出なし"}
              </li>
            </ul>
          </div>
          <div>
            <div className="metric-label">契約状況</div>
            <ul className="mt-1 space-y-0.5 text-[12px] text-slate-600">
              <li>{overview.contractCount}件 / {formatJpy(overview.totalPremium)}</li>
              <li>被保険者 {formatNum(overview.totalInsured)}名</li>
              <li>90日以内満期 {overview.expiring90d}件</li>
              <li className="leading-relaxed">
                加入: {overview.coveredCategories.length ? overview.coveredCategories.join("、") : "なし"}
              </li>
            </ul>
          </div>
          <div>
            <div className="metric-label">検出トリガー</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {overview.attack.triggers.length ? (
                overview.attack.triggers.map((t) => <TriggerBadge key={t} trigger={t} />)
              ) : (
                <span className="text-[12px] text-muted-foreground">なし</span>
              )}
            </div>
            <div className="mt-1.5 text-[12px] text-slate-600">
              商談 {overview.meetingCount}回 / 平均品質 {overview.avgMeetingQuality ?? "—"}
            </div>
          </div>
        </div>
      </Panel>

      {/*
        提案ストーリー（③商談前の仮説）と提案書（⑤再訪問）は縦に積む。
        横2カラムだと各カラムが半幅になり、章立てや根拠データの長文が細く折り返されて
        読みにくくなるため、幅を活かして上下に並べる。
      */}
      <div className="space-y-4">
        {/* Proposal story */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              提案ストーリー
              <span className="text-[12px] font-normal text-muted-foreground">
                （事前準備・課題仮説とヒアリング設計）
              </span>
            </h2>
            <button
              type="button"
              onClick={() => storyMutation.mutate()}
              disabled={storyMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-primary)] px-2.5 py-1.5
                         text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {storyMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              {storyMutation.isPending ? "生成中（30〜60秒）…" : "AIで生成"}
            </button>
          </div>

          {storyMutation.isError && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {(storyMutation.error as Error).message}
            </div>
          )}

          {stories.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {stories.map((s, i) => (
                <button
                  key={s.storyId}
                  type="button"
                  onClick={() => setSelectedStory(s.storyId)}
                  className={cn(
                    "rounded border px-2 py-1 text-[11px] font-medium",
                    s.storyId === story?.storyId
                      ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
                  )}
                >
                  v{stories.length - i} {s.createdAt?.slice(0, 10)}
                </button>
              ))}
            </div>
          )}

          {!story ? (
            <Panel title="未作成">
              <EmptyState message="「AIで生成」を押すと、求人シグナル・財務・過去商談のニーズと、トップ営業の暗黙知を踏まえた提案ストーリーが作成されます。" />
            </Panel>
          ) : (
            <div className="space-y-3">
              <Panel title={story.title || "提案ストーリー"}>
                <div className="space-y-3 text-xs">
                  <div>
                    <div className="metric-label">課題仮説</div>
                    <p className="mt-0.5 leading-relaxed text-slate-700">{story.hypothesis}</p>
                  </div>
                  {story.keyIssues.length > 0 && (
                    <div>
                      <div className="metric-label">想定される課題</div>
                      <ul className="mt-0.5 space-y-1">
                        {story.keyIssues.map((k, i) => (
                          <li key={i} className="flex gap-1.5 leading-relaxed text-slate-700">
                            <span className="text-[var(--brand-primary)]">・</span>
                            <span>{k}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {story.appliedKnowledgeIds.length > 0 && (
                    <div className="border-t border-slate-100 pt-2">
                      <div className="metric-label">適用した暗黙知パターン</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {story.appliedKnowledgeIds.map((id) => (
                          <span
                            key={id}
                            className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 font-mono text-[11px] text-sky-700"
                          >
                            {id}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Panel>

              <Panel
                title={
                  <span className="inline-flex items-center gap-1.5">
                    <MessageSquareQuote className="h-4 w-4 text-[var(--brand-primary)]" />
                    ヒアリング設計 {story.hearingQuestions.length}問
                  </span>
                }
                bodyClassName="p-0"
              >
                {story.hearingQuestions.length === 0 ? (
                  <EmptyState message="質問が生成されていません。" />
                ) : (
                  <ol className="divide-y divide-border">
                    {story.hearingQuestions.map((q, i) => (
                      <li key={i} className="px-4 py-2.5">
                        <div className="flex gap-2">
                          <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[var(--brand-primary)] text-[10px] font-bold text-white">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs leading-relaxed text-slate-900">{q.question}</p>
                            {q.intent && (
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                意図: {q.intent}
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </Panel>

              <Panel title={`想定反論と切り返し ${story.expectedObjections.length}件`} bodyClassName="p-0">
                {story.expectedObjections.length === 0 ? (
                  <EmptyState message="想定反論が生成されていません。" />
                ) : (
                  <ul className="divide-y divide-border">
                    {story.expectedObjections.map((o, i) => (
                      <li key={i} className="px-4 py-2.5">
                        <div className="text-xs font-medium text-rose-700">「{o.objection}」</div>
                        <p className="evidence-quote mt-1 not-italic">{o.response}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              {story.recommendedProducts.length > 0 && (
                <Panel title="推奨商品" bodyClassName="p-0">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="w-40">商品</th>
                        <th>推奨理由</th>
                      </tr>
                    </thead>
                    <tbody>
                      {story.recommendedProducts.map((p, i) => (
                        <tr key={i}>
                          <td className="font-medium">{p.product}</td>
                          <td className="text-[12px] leading-relaxed text-slate-600">{p.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Panel>
              )}
            </div>
          )}
        </div>

        {/* Proposal document */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">
              <FileText className="h-4 w-4 text-[var(--brand-primary)]" />
              提案書
              <span className="text-[12px] font-normal text-muted-foreground">
                （数値根拠を差し込んだドラフト）
              </span>
            </h2>
            <div className="flex gap-1.5">
              {proposal && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        proposalToMarkdown(proposal, overview.companyName),
                      )
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white
                               px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <ClipboardCheck className="h-3 w-3" />
                    {copied ? "コピーしました" : "コピー"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      download(
                        `提案書_${overview.companyName}_v${proposal.version}.md`,
                        proposalToMarkdown(proposal, overview.companyName),
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white
                               px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-3 w-3" />
                    出力
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => proposalMutation.mutate()}
                disabled={proposalMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-primary)] px-2.5 py-1.5
                           text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {proposalMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                {proposalMutation.isPending ? "生成中（40〜90秒）…" : "AIで生成"}
              </button>
            </div>
          </div>

          {proposalMutation.isError && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {(proposalMutation.error as Error).message}
            </div>
          )}

          {!proposal ? (
            <Panel title="未作成">
              <EmptyState
                message={
                  story
                    ? "「AIで生成」を押すと、上の提案ストーリーと顧客の実データから章立ての提案書ドラフトが作成されます。"
                    : "先に提案ストーリーを生成すると、その方向性に沿った提案書が作成されます。ストーリーなしでも生成可能です。"
                }
              />
            </Panel>
          ) : (
            <div className="space-y-3">
              <Panel
                title={proposal.title || "提案書"}
                actions={
                  <span className="text-[11px] text-muted-foreground">
                    v{proposal.version} / {proposal.createdAt?.slice(0, 10)} / {proposal.modelUsed}
                  </span>
                }
              >
                <div className="space-y-3">
                  {proposal.executiveSummary && (
                    <div className="rounded-md bg-slate-50 p-3">
                      <div className="metric-label">エグゼクティブサマリー</div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-800">
                        {proposal.executiveSummary}
                      </p>
                    </div>
                  )}
                  <div className="flex items-baseline gap-4 border-t border-slate-100 pt-2 text-xs">
                    <div>
                      <span className="metric-label">想定年間保険料</span>
                      <div className="text-base font-semibold tabular-nums text-slate-900">
                        {formatJpy(proposal.estimatedPremium)}
                      </div>
                    </div>
                    <div>
                      <span className="metric-label">現行年間保険料</span>
                      <div className="text-base font-semibold tabular-nums text-slate-500">
                        {formatJpy(overview.totalPremium)}
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>

              {proposal.sections.map((s, i) => (
                <Panel key={i} title={`${i + 1}. ${s.heading}`}>
                  <p className="text-xs leading-relaxed text-slate-700">{s.body}</p>
                  {s.evidence?.length ? (
                    <div className="mt-2 border-t border-slate-100 pt-2">
                      <div className="metric-label">引用した根拠データ</div>
                      <ul className="mt-0.5 space-y-0.5">
                        {s.evidence.map((e, j) => (
                          <li key={j} className="text-[11px] text-muted-foreground">
                            ・{e}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </Panel>
              ))}

              {proposal.recommendedProducts.length > 0 && (
                <Panel title="推奨商品と想定保険料" bodyClassName="p-0">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="w-40">商品</th>
                        <th>推奨理由</th>
                        <th className="w-24 text-right">想定年間保険料</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proposal.recommendedProducts.map((p, i) => (
                        <tr key={i}>
                          <td className="font-medium">{p.product}</td>
                          <td className="text-[12px] leading-relaxed text-slate-600">{p.reason}</td>
                          <td className="text-right tabular-nums">
                            {p.estimatedPremium > 0 ? formatJpy(p.estimatedPremium) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Panel>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
