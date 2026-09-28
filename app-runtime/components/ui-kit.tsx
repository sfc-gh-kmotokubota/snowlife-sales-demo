import { cn } from "@/lib/utils"
import { GRADE_STYLES, TRIGGER_STYLES } from "@/lib/constants"

/** Attack grade badge (S/A/B/C). */
export function GradeBadge({ grade, className }: { grade: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded text-[12px] font-bold",
        GRADE_STYLES[grade] ?? GRADE_STYLES.C,
        className,
      )}
      title={`アタック優先度 ${grade}`}
    >
      {grade}
    </span>
  )
}

/** Trigger chip — the business reason a company surfaced on the attack list. */
export function TriggerBadge({ trigger, className }: { trigger: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
        TRIGGER_STYLES[trigger] ?? TRIGGER_STYLES.定期フォロー,
        className,
      )}
    >
      {trigger}
    </span>
  )
}

/** Meeting outcome chip. */
export function OutcomeBadge({ outcome }: { outcome: string | null }) {
  if (!outcome) return <span className="text-muted-foreground">—</span>
  const styles: Record<string, string> = {
    成約: "bg-emerald-100 text-emerald-800",
    ランクアップ: "bg-sky-100 text-sky-800",
    継続検討: "bg-slate-100 text-slate-700",
    停滞: "bg-rose-100 text-rose-800",
  }
  return (
    <span
      className={cn(
        "inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
        styles[outcome] ?? styles.継続検討,
      )}
    >
      {outcome}
    </span>
  )
}

/** Customer sentiment chip. */
export function SentimentBadge({ sentiment }: { sentiment: string | null }) {
  if (!sentiment) return <span className="text-muted-foreground">—</span>
  const map: Record<string, { label: string; cls: string }> = {
    POSITIVE: { label: "好意的", cls: "bg-emerald-100 text-emerald-800" },
    NEUTRAL: { label: "中立", cls: "bg-slate-100 text-slate-700" },
    NEGATIVE: { label: "消極的", cls: "bg-rose-100 text-rose-800" },
  }
  const s = map[sentiment] ?? map.NEUTRAL
  return (
    <span className={cn("inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium", s.cls)}>
      {s.label}
    </span>
  )
}

/** Priority chip for next actions. */
export function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    高: "bg-rose-100 text-rose-800",
    中: "bg-amber-100 text-amber-800",
    低: "bg-slate-100 text-slate-600",
  }
  return (
    <span className={cn("inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium", styles[priority] ?? styles.中)}>
      {priority}
    </span>
  )
}

/** Signal strength shown as filled dots (1-5). */
export function SignalStrength({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`シグナル強度 ${value}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            i <= value ? "bg-[var(--brand-accent)]" : "bg-slate-200",
          )}
        />
      ))}
    </span>
  )
}

/** Horizontal score bar used for the 0-100 component scores. */
export function ScoreBar({
  label,
  value,
  weighted,
  weight,
}: {
  label: string
  value: number
  weighted?: number
  weight?: number
}) {
  const tone =
    value >= 80 ? "bg-rose-500" : value >= 60 ? "bg-amber-500" : value >= 40 ? "bg-sky-500" : "bg-slate-300"
  return (
    <div className="space-y-0.5">
      <div className="flex items-baseline justify-between gap-2 text-[12px]">
        <span className="text-slate-600">
          {label}
          {weight !== undefined && <span className="ml-1 text-slate-400">×{weight}</span>}
        </span>
        <span className="tabular-nums font-medium text-slate-700">
          {value}
          {weighted !== undefined && (
            <span className="ml-1 text-[11px] font-normal text-slate-400">(+{weighted.toFixed(1)})</span>
          )}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  )
}

/** KPI tile for dashboards. */
export function KpiCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string
  value: string
  sub?: string
  tone?: "default" | "warn" | "danger" | "good"
}) {
  const toneCls = {
    default: "text-slate-900",
    warn: "text-amber-600",
    danger: "text-rose-600",
    good: "text-emerald-600",
  }[tone]
  return (
    <div className="panel px-3.5 py-3">
      <div className="metric-label">{label}</div>
      <div className={cn("metric-value mt-0.5", toneCls)}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  )
}

/** Skill-tier chip for a sales rep. */
export function TierBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    トップ: "bg-amber-100 text-amber-800 border-amber-300",
    中堅: "bg-sky-100 text-sky-800 border-sky-300",
    若手: "bg-slate-100 text-slate-700 border-slate-300",
  }
  return (
    <span
      className={cn(
        "inline-flex rounded border px-1.5 py-0.5 text-[11px] font-medium",
        styles[tier] ?? styles.若手,
      )}
    >
      {tier}
    </span>
  )
}

/** Empty-state row for tables and panels. */
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="px-4 py-10 text-center text-xs text-muted-foreground">{message}</div>
  )
}

/** Section wrapper with a consistent header. */
export function Panel({
  title,
  actions,
  children,
  bodyClassName,
}: {
  title: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  bodyClassName?: string
}) {
  return (
    <section className="panel overflow-hidden">
      <div className="panel-header">
        <h2 className="panel-title">{title}</h2>
        {actions}
      </div>
      <div className={bodyClassName ?? "panel-body"}>{children}</div>
    </section>
  )
}
