"use client"

import { Fragment, useCallback, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useMutation, useQuery } from "@tanstack/react-query"
import { ChevronDown, Filter, Loader2, Sparkles, X } from "lucide-react"
import type { AttackListRow } from "@/lib/queries"
import { SIGNAL_TYPES } from "@/lib/constants"
import { daysAgoLabel, formatJpy, formatNum } from "@/lib/format"
import {
  EmptyState,
  GradeBadge,
  Panel,
  ScoreBar,
  SignalStrength,
  TriggerBadge,
} from "@/components/ui-kit"
import { cn } from "@/lib/utils"

const TRIGGER_OPTIONS = [
  "満期接近",
  "キーマン未接触",
  "接点劣化",
  "求人シグナル強",
  "事業イベント",
  "契約空白大",
  "離職率高",
  "健康経営未着手",
  "DC移行検討",
] as const

const GRADE_OPTIONS = ["S", "A", "B", "C"] as const

interface ApiResponse {
  rows: AttackListRow[]
  options: { industries: string[] }
}

interface AiReason {
  company_id: string
  headline: string
  reason: string
  recommended_approach: string
  talking_point: string
}

/** Multi-select chip group used for every filter dimension. */
function ChipGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  options: readonly string[]
  selected: string[]
  onToggle: (v: string) => void
}) {
  return (
    <div>
      <div className="metric-label mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = selected.includes(o)
          return (
            <button
              key={o}
              type="button"
              onClick={() => onToggle(o)}
              aria-pressed={active}
              className={cn(
                "rounded border px-2 py-1 text-[12px] font-medium transition-colors",
                active
                  ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50",
              )}
            >
              {o}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function AttackListClient() {
  const params = useSearchParams()
  const rep = params.get("rep") ?? ""

  const [industries, setIndustries] = useState<string[]>([])
  const [signals, setSignals] = useState<string[]>([])
  const [triggers, setTriggers] = useState<string[]>([])
  const [grades, setGrades] = useState<string[]>([])
  const [minEmployees, setMinEmployees] = useState("")
  const [minScore, setMinScore] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [reasons, setReasons] = useState<Record<string, AiReason>>({})

  const queryString = useMemo(() => {
    const q = new URLSearchParams()
    if (rep) q.set("rep", rep)
    industries.forEach((v) => q.append("industry", v))
    signals.forEach((v) => q.append("signal", v))
    triggers.forEach((v) => q.append("trigger", v))
    grades.forEach((v) => q.append("grade", v))
    if (minEmployees) q.set("minEmployees", minEmployees)
    if (minScore) q.set("minScore", minScore)
    return q.toString()
  }, [rep, industries, signals, triggers, grades, minEmployees, minScore])

  const { data, isLoading, isError, error } = useQuery<ApiResponse>({
    queryKey: ["attack-list", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/attack-list?${queryString}`)
      if (!res.ok) throw new Error((await res.json()).error ?? "取得に失敗しました")
      return res.json()
    },
  })

  const rows = data?.rows ?? []

  const reasonMutation = useMutation({
    mutationFn: async (companyIds: string[]) => {
      const res = await fetch("/api/ai/attack-reason", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companyIds }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "AI生成に失敗しました")
      return (await res.json()) as { companies: AiReason[] }
    },
    onSuccess: (d) => {
      setReasons((prev) => {
        const next = { ...prev }
        for (const c of d.companies) next[c.company_id] = c
        return next
      })
    },
  })

  const toggle = useCallback(
    (setter: React.Dispatch<React.SetStateAction<string[]>>) => (v: string) =>
      setter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])),
    [],
  )

  const clearAll = () => {
    setIndustries([])
    setSignals([])
    setTriggers([])
    setGrades([])
    setMinEmployees("")
    setMinScore("")
  }

  const activeFilterCount =
    industries.length + signals.length + triggers.length + grades.length +
    (minEmployees ? 1 : 0) + (minScore ? 1 : 0)

  const repHref = (href: string) => (rep ? `${href}?rep=${encodeURIComponent(rep)}` : href)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">アタックリスト抽出</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            求人シグナル・契約空白・満期接近・接点空白を重み付けした複合スコアで優先度を判定します。
          </p>
        </div>
        <button
          type="button"
          onClick={() => reasonMutation.mutate(rows.slice(0, 8).map((r) => r.companyId))}
          disabled={reasonMutation.isPending || rows.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-primary)] px-3 py-2
                     text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {reasonMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          上位8社の推奨理由をAI生成
        </button>
      </div>

      {/* Filters */}
      <Panel
        title={
          <span className="inline-flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-[var(--brand-primary)]" />
            抽出条件
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-[var(--brand-primary)] px-1.5 text-[11px] text-white">
                {activeFilterCount}
              </span>
            )}
          </span>
        }
        actions={
          activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-slate-900"
            >
              <X className="h-3 w-3" />
              条件をクリア
            </button>
          )
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <ChipGroup
            label="求人シグナル種別"
            options={SIGNAL_TYPES}
            selected={signals}
            onToggle={toggle(setSignals)}
          />
          <ChipGroup
            label="検出トリガー"
            options={TRIGGER_OPTIONS}
            selected={triggers}
            onToggle={toggle(setTriggers)}
          />
          <ChipGroup
            label="業種"
            options={data?.options.industries ?? []}
            selected={industries}
            onToggle={toggle(setIndustries)}
          />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="metric-label mb-1.5">優先度</div>
              <div className="flex gap-1.5">
                {GRADE_OPTIONS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggle(setGrades)(g)}
                    aria-pressed={grades.includes(g)}
                    className={cn(
                      "h-7 w-7 rounded border text-[12px] font-bold transition-colors",
                      grades.includes(g)
                        ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="metric-label mb-1.5 block" htmlFor="minEmp">
                従業員数（以上）
              </label>
              <input
                id="minEmp"
                type="number"
                min={0}
                step={1000}
                value={minEmployees}
                onChange={(e) => setMinEmployees(e.target.value)}
                placeholder="例 30000"
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs
                           focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="metric-label mb-1.5 block" htmlFor="minScore">
                総合スコア（以上）
              </label>
              <input
                id="minScore"
                type="number"
                min={0}
                max={100}
                value={minScore}
                onChange={(e) => setMinScore(e.target.value)}
                placeholder="例 70"
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs
                           focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </div>
          </div>
        </div>
      </Panel>

      {reasonMutation.isError && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          AI生成に失敗しました: {(reasonMutation.error as Error).message}
        </div>
      )}

      {/* Result table */}
      <Panel
        title={`抽出結果 ${rows.length}社`}
        actions={
          <span className="text-[12px] text-muted-foreground">
            総合スコア = 求人シグナル×0.28 + 契約空白×0.18 + 満期接近×0.14 + イベント鮮度×0.14 +
            接点空白×0.12 + 財務×0.08 + 規模×0.06
          </span>
        }
        bodyClassName="p-0"
      >
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            抽出中…
          </div>
        ) : isError ? (
          <div className="px-4 py-8 text-center text-xs text-rose-700">
            {(error as Error).message}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState message="条件に一致する企業がありません。条件を緩めてください。" />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-8" />
                  <th className="w-8">優先</th>
                  <th className="min-w-[13rem]">企業名</th>
                  <th className="w-16 text-right">総合<br />スコア</th>
                  <th className="min-w-[11rem]">検出トリガー</th>
                  <th className="w-24">主シグナル</th>
                  <th className="w-16 text-right">求人<br />90日</th>
                  <th className="w-20 text-right">従業員数</th>
                  <th className="w-20 text-right">年間保険料</th>
                  <th className="w-16 text-right">満期<br />90日</th>
                  <th className="w-20 text-right">最終接触</th>
                  <th className="w-16 text-center">決裁者<br />接触</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const open = expanded === r.companyId
                  const ai = reasons[r.companyId]
                  return (
                    <Fragment key={r.companyId}>
                      <tr className={open ? "bg-sky-50/60" : undefined}>
                        <td>
                          <button
                            type="button"
                            onClick={() => setExpanded(open ? null : r.companyId)}
                            aria-label={open ? "詳細を閉じる" : "詳細を開く"}
                            aria-expanded={open}
                            className="grid h-5 w-5 place-items-center rounded hover:bg-slate-200"
                          >
                            <ChevronDown
                              className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
                            />
                          </button>
                        </td>
                        <td>
                          <GradeBadge grade={r.grade} />
                        </td>
                        <td>
                          <Link
                            href={repHref(`/customers/${r.companyId}`)}
                            className="font-medium text-slate-900 hover:text-[var(--brand-primary)] hover:underline"
                          >
                            {r.companyName}
                          </Link>
                          <div className="text-[11px] text-muted-foreground">
                            {r.industryDetail} / {r.prefecture} / 見込み{r.prospectRank}
                            {!rep && ` / ${r.salesRepName}`}
                          </div>
                        </td>
                        <td className="text-right">
                          <span className="text-sm font-semibold tabular-nums">{r.totalScore}</span>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {r.triggers.length === 0 ? (
                              <span className="text-[11px] text-muted-foreground">—</span>
                            ) : (
                              r.triggers.map((t) => <TriggerBadge key={t} trigger={t} />)
                            )}
                          </div>
                        </td>
                        <td className="text-[12px]">
                          {r.topSignalType ? (
                            <span className="inline-flex flex-col gap-0.5">
                              <span>{r.topSignalType}</span>
                              <SignalStrength value={Math.min(5, Math.ceil(r.scores.hiring / 20))} />
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="text-right tabular-nums">
                          {r.recentPostings90d}
                          <span className="ml-0.5 text-[11px] text-muted-foreground">件</span>
                        </td>
                        <td className="text-right tabular-nums">{formatNum(r.employeeCount)}</td>
                        <td className="text-right tabular-nums">{formatJpy(r.totalPremium)}</td>
                        <td className="text-right">
                          {r.expiring90d > 0 ? (
                            <span className="font-semibold text-rose-600">{r.expiring90d}件</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="text-right text-[12px]">
                          <span
                            className={
                              r.daysSinceTouch > 150
                                ? "font-medium text-amber-600"
                                : "text-slate-600"
                            }
                          >
                            {daysAgoLabel(r.daysSinceTouch)}
                          </span>
                        </td>
                        <td className="text-center">
                          {r.hasDmContact ? (
                            <span className="text-emerald-600">✓</span>
                          ) : (
                            <span className="font-bold text-rose-600">✕</span>
                          )}
                        </td>
                      </tr>

                      {open && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={12} className="px-4 py-4">
                            <div className="grid gap-5 lg:grid-cols-3">
                              {/* Score breakdown */}
                              <div>
                                <div className="mb-2 text-xs font-semibold text-slate-700">
                                  スコア内訳
                                </div>
                                <div className="space-y-2">
                                  <ScoreBar label="求人シグナル" value={r.scores.hiring} weighted={r.weighted.hiring} weight={0.28} />
                                  <ScoreBar label="契約空白" value={r.scores.contractGap} weighted={r.weighted.contractGap} weight={0.18} />
                                  <ScoreBar label="満期接近" value={r.scores.renewal} weighted={r.weighted.renewal} weight={0.14} />
                                  <ScoreBar label="イベント鮮度" value={r.scores.eventFresh} weighted={r.weighted.eventFresh} weight={0.14} />
                                  <ScoreBar label="接点空白" value={r.scores.contactGap} weighted={r.weighted.contactGap} weight={0.12} />
                                  <ScoreBar label="財務健全性" value={r.scores.financial} weighted={r.weighted.financial} weight={0.08} />
                                  <ScoreBar label="従業員規模" value={r.scores.scale} weighted={r.weighted.scale} weight={0.06} />
                                </div>
                              </div>

                              {/* Signal evidence */}
                              <div className="space-y-2.5">
                                <div className="text-xs font-semibold text-slate-700">
                                  求人シグナルの根拠
                                </div>
                                {r.topSignalType ? (
                                  <div className="space-y-1.5 text-[12px] text-slate-600">
                                    <div>
                                      <span className="font-medium text-slate-800">
                                        {r.topSignalType}
                                      </span>
                                      {r.topJobTitle && `：「${r.topJobTitle}」`}
                                    </div>
                                    {r.topSignalRationale && (
                                      <p className="leading-relaxed">{r.topSignalRationale}</p>
                                    )}
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-1 text-[11px]">
                                      <span>求人総数: {r.postingCount}件</span>
                                      <span>直近90日: {r.recentPostings90d}件</span>
                                      <span>シグナル種別: {r.signalTypeCount}種</span>
                                      <span>直近募集人数: {formatNum(r.recentOpenings90d)}名</span>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-[12px] text-muted-foreground">
                                    求人シグナルは検出されていません。
                                  </p>
                                )}
                                <div className="border-t border-slate-200 pt-2 text-[12px] text-slate-600">
                                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                                    <span>年金制度: {r.pensionType ?? "—"}</span>
                                    <span>離職率: {r.turnoverRate}%</span>
                                    <span className="col-span-2">
                                      健康経営: {r.healthCertStatus ?? "なし"}
                                    </span>
                                    <span>登録キーマン: {r.contactCount}名</span>
                                    <span>未処理アラート: {r.alertCount}件</span>
                                  </div>
                                </div>
                              </div>

                              {/* AI reasoning */}
                              <div>
                                <div className="mb-2 text-xs font-semibold text-slate-700">
                                  AI推奨理由とアプローチ
                                </div>
                                {ai ? (
                                  <div className="space-y-2 text-[12px] leading-relaxed">
                                    <div className="font-medium text-slate-900">{ai.headline}</div>
                                    <p className="text-slate-600">{ai.reason}</p>
                                    <div>
                                      <div className="metric-label">推奨アプローチ</div>
                                      <p className="text-slate-600">{ai.recommended_approach}</p>
                                    </div>
                                    <div>
                                      <div className="metric-label">切り出しトーク例</div>
                                      <p className="evidence-quote not-italic">{ai.talking_point}</p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <p className="text-[12px] text-muted-foreground">
                                      「上位8社の推奨理由をAI生成」を実行すると、この企業に今アプローチすべき理由と初回トークが表示されます。
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => reasonMutation.mutate([r.companyId])}
                                      disabled={reasonMutation.isPending}
                                      className="inline-flex items-center gap-1.5 rounded border border-[var(--brand-primary)]
                                                 px-2 py-1 text-[12px] font-medium text-[var(--brand-primary)]
                                                 hover:bg-sky-50 disabled:opacity-50"
                                    >
                                      {reasonMutation.isPending ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Sparkles className="h-3 w-3" />
                                      )}
                                      この企業だけ生成
                                    </button>
                                  </div>
                                )}
                                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-2">
                                  <Link
                                    href={repHref(`/customers/${r.companyId}`)}
                                    className="rounded border border-slate-300 bg-white px-2 py-1 text-[12px]
                                               font-medium text-slate-700 hover:bg-slate-50"
                                  >
                                    顧客情報を見る
                                  </Link>
                                  <Link
                                    href={repHref(`/proposals/${r.companyId}`)}
                                    className="rounded border border-slate-300 bg-white px-2 py-1 text-[12px]
                                               font-medium text-slate-700 hover:bg-slate-50"
                                  >
                                    提案ストーリーを作る
                                  </Link>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
