"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { BookOpen, ChevronDown, Loader2, Quote, Search, ShieldCheck } from "lucide-react"
import { KNOWLEDGE_CATEGORIES } from "@/lib/constants"
import type { TacitKnowledge } from "@/lib/queries"
import { EmptyState, KpiCard, Panel, TierBadge } from "@/components/ui-kit"
import { TierComparisonChart } from "@/components/dashboard-charts"
import { cn } from "@/lib/utils"

interface KnowledgeResponse {
  items: TacitKnowledge[]
  stats: {
    byCategory: { category: string; patterns: number; avgConfidence: number; totalUsage: number }[]
    byTier: {
      skillTier: string
      avgQuality: number
      avgQuestions: number
      avgDeepNeeds: number
      winRate: number
      meetings: number
    }[]
  }
  searched: boolean
  matched?: number
}

const CATEGORY_COLORS: Record<string, string> = {
  課題の引き出し方: "border-l-sky-500",
  反論への切り返し: "border-l-rose-500",
  数値と事例の使い方: "border-l-amber-500",
  キーマン攻略: "border-l-violet-500",
  クロージングと次アクション設計: "border-l-emerald-500",
}

function KnowledgeCard({ k }: { k: TacitKnowledge }) {
  const [open, setOpen] = useState(false)
  const verified = Math.round(k.evidenceVerifiedPct * 100)

  return (
    <article
      className={cn(
        "panel border-l-4 overflow-hidden",
        CATEGORY_COLORS[k.category] ?? "border-l-slate-400",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
              {k.category}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">{k.knowledgeId}</span>
            {verified === 100 && (
              <span className="inline-flex items-center gap-0.5 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                <ShieldCheck className="h-2.5 w-2.5" />
                引用検証済み
              </span>
            )}
          </div>
          <h3 className="mt-1 text-sm font-semibold leading-snug text-slate-900">
            {k.patternTitle}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span>確信度 {(k.confidence * 100).toFixed(0)}%</span>
            <span>出典: {k.sourceRepName}（成約率{Math.round(k.winRate * 100)}%）</span>
            <span>引用 {k.evidenceQuotes.length}件</span>
            <span>参照 {k.usageCount}回</span>
            <span>適用: {k.applicableIndustry}</span>
          </div>
        </div>
        <ChevronDown
          className={cn("mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="space-y-3 border-t border-border bg-slate-50/60 px-4 py-3">
          <div>
            <div className="metric-label">パターンの内容</div>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-700">{k.patternDetail}</p>
          </div>
          {k.whenToUse && (
            <div>
              <div className="metric-label">使うべき場面</div>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-700">{k.whenToUse}</p>
            </div>
          )}
          {k.talkScript && (
            <div>
              <div className="metric-label">トークスクリプト例</div>
              <p className="evidence-quote mt-0.5 not-italic">{k.talkScript}</p>
            </div>
          )}
          {k.evidenceQuotes.length > 0 && (
            <div>
              <div className="metric-label flex items-center gap-1">
                <Quote className="h-3 w-3" />
                実際の商談での発言（{k.sourceRepName}）
              </div>
              <ul className="mt-1 space-y-1.5">
                {k.evidenceQuotes.map((q, i) => (
                  <li key={i} className="evidence-quote">
                    {q}
                  </li>
                ))}
              </ul>
              {k.sourceMeetingIds.length > 0 && (
                <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                  出典商談: {k.sourceMeetingIds.join(", ")}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  )
}

export function KnowledgeClient() {
  const [category, setCategory] = useState<string>("all")
  const [queryText, setQueryText] = useState("")
  const [submitted, setSubmitted] = useState("")

  const { data, isLoading, isError, error } = useQuery<KnowledgeResponse>({
    queryKey: ["knowledge", category, submitted],
    queryFn: async () => {
      const q = new URLSearchParams()
      if (category !== "all") q.set("category", category)
      if (submitted) q.set("q", submitted)
      const res = await fetch(`/api/knowledge?${q.toString()}`)
      if (!res.ok) throw new Error((await res.json()).error ?? "取得に失敗しました")
      return res.json()
    },
  })

  const items = data?.items ?? []
  const stats = data?.stats
  const top = stats?.byTier.find((t) => t.skillTier === "トップ")
  const junior = stats?.byTier.find((t) => t.skillTier === "若手")

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">暗黙知ライブラリ</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          トップ営業の成約商談から AI が抽出した再現可能な行動パターン。すべてのパターンに実際の発言引用が根拠として紐づいています。
        </p>
      </div>

      {/* Why this matters — the skill gap the library closes */}
      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard
          label="抽出パターン数"
          value={`${items.length}件`}
          sub={`${stats?.byCategory.length ?? 0}カテゴリ`}
        />
        <KpiCard
          label="トップ営業の商談品質"
          value={top ? `${top.avgQuality}` : "—"}
          tone="good"
          sub={top ? `成約率 ${Math.round(top.winRate * 100)}% / 商談 ${top.meetings}件` : undefined}
        />
        <KpiCard
          label="若手営業の商談品質"
          value={junior ? `${junior.avgQuality}` : "—"}
          tone="danger"
          sub={
            junior
              ? `成約率 ${Math.round(junior.winRate * 100)}% / 商談 ${junior.meetings}件`
              : undefined
          }
        />
        <KpiCard
          label="ヒアリング質問数の差"
          value={top && junior ? `${(top.avgQuestions - junior.avgQuestions).toFixed(1)}回` : "—"}
          tone="warn"
          sub={
            top && junior
              ? `トップ ${top.avgQuestions}回 vs 若手 ${junior.avgQuestions}回`
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-4">
          {/* Search + filter */}
          <Panel
            title={
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-[var(--brand-primary)]" />
                パターン検索
              </span>
            }
          >
            <div className="space-y-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  setSubmitted(queryText.trim())
                }}
                className="flex gap-2"
              >
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    value={queryText}
                    onChange={(e) => setQueryText(e.target.value)}
                    placeholder="例: コスト懸念を言われたときの切り返し"
                    aria-label="暗黙知を自然言語で検索"
                    className="w-full rounded border border-slate-300 py-2 pl-8 pr-2 text-xs
                               focus:border-[var(--brand-primary)] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-md bg-[var(--brand-primary)] px-3 py-2 text-xs font-medium text-white hover:opacity-90"
                >
                  検索
                </button>
                {submitted && (
                  <button
                    type="button"
                    onClick={() => {
                      setQueryText("")
                      setSubmitted("")
                    }}
                    className="rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    クリア
                  </button>
                )}
              </form>

              <div className="flex flex-wrap gap-1.5">
                {(["all", ...KNOWLEDGE_CATEGORIES] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    aria-pressed={category === c}
                    className={cn(
                      "rounded border px-2 py-1 text-[12px] font-medium transition-colors",
                      category === c
                        ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {c === "all" ? "すべて" : c}
                  </button>
                ))}
              </div>

              {data?.searched && (
                <p className="text-[12px] text-muted-foreground">
                  Cortex Search による関連度順に {data.matched}件を表示しています。
                </p>
              )}
            </div>
          </Panel>

          {/* Pattern list */}
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              読み込み中…
            </div>
          ) : isError ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {(error as Error).message}
            </div>
          ) : items.length === 0 ? (
            <Panel title="検索結果">
              <EmptyState message="該当するパターンが見つかりませんでした。" />
            </Panel>
          ) : (
            <div className="space-y-2.5">
              {items.map((k) => (
                <KnowledgeCard key={k.knowledgeId} k={k} />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Panel title="スキル階層別の比較">
            <TierComparisonChart data={stats?.byTier ?? []} />
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              ヒアリング質問数の差が商談品質と成約率の差に直結しています。暗黙知ライブラリはこの差を埋めるための行動指針です。
            </p>
          </Panel>

          <Panel title="カテゴリ別のパターン数" bodyClassName="p-0">
            {!stats?.byCategory.length ? (
              <EmptyState message="データがありません。" />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>カテゴリ</th>
                    <th className="w-14 text-right">件数</th>
                    <th className="w-16 text-right">確信度</th>
                    <th className="w-14 text-right">参照</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byCategory.map((c) => (
                    <tr key={c.category}>
                      <td className="text-[12px]">{c.category}</td>
                      <td className="text-right tabular-nums">{c.patterns}</td>
                      <td className="text-right tabular-nums">
                        {(c.avgConfidence * 100).toFixed(0)}%
                      </td>
                      <td className="text-right tabular-nums">{c.totalUsage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel title="スキル階層の実績">
            <ul className="space-y-2.5">
              {(stats?.byTier ?? [])
                .slice()
                .sort((a, b) => b.avgQuality - a.avgQuality)
                .map((t) => (
                  <li key={t.skillTier} className="border-b border-slate-100 pb-2 last:border-0">
                    <div className="flex items-center justify-between">
                      <TierBadge tier={t.skillTier} />
                      <span className="text-xs font-semibold tabular-nums">{t.avgQuality}</span>
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-x-2 text-[11px] text-muted-foreground">
                      <span>成約率 {Math.round(t.winRate * 100)}%</span>
                      <span>質問 {t.avgQuestions}回</span>
                      <span>深層ニーズ {t.avgDeepNeeds}件</span>
                      <span>商談 {t.meetings}件</span>
                    </div>
                  </li>
                ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}
