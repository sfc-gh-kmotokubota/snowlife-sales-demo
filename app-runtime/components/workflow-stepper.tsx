"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { Check } from "lucide-react"
import { WORKFLOW_STAGES, type WorkflowStageId } from "@/lib/constants"
import { RepLink } from "@/components/rep-switcher"
import { cn } from "@/lib/utils"

/**
 * Workflow stepper. Mirrors the five stages of the corporate sales process
 * (お客様選定 → 事前準備 → 商談 → 振り返り → 再訪問) so the user always sees
 * which part of the process the current screen supports.
 *
 * The active stage is normally derived from the URL, but a page can override it
 * via `activeStage` when the mapping is not one-to-one.
 *
 * 商談 and 振り返り share the `/meetings` route, so the stage is additionally
 * carried in a `?stage=` query param. Without it, clicking 振り返り would land on
 * the same URL as 商談 and appear to do nothing.
 */
export function WorkflowStepper({ activeStage }: { activeStage?: WorkflowStageId }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const stageParam = searchParams.get("stage")
  const fromParam = WORKFLOW_STAGES.some((s) => s.id === stageParam)
    ? (stageParam as WorkflowStageId)
    : null

  const derived: WorkflowStageId = fromParam
    ? fromParam
    : activeStage
      ? activeStage
      : pathname.startsWith("/attack-list")
      ? "select"
      : pathname.startsWith("/customers")
        ? "prepare"
        : pathname.startsWith("/meetings")
          ? "meeting"
          : pathname.startsWith("/proposal")
            ? "revisit"
            : "select"

  const activeIndex = WORKFLOW_STAGES.findIndex((s) => s.id === derived)

  return (
    <nav aria-label="営業業務フロー" className="border-b border-border bg-slate-50/80">
      <ol className="flex w-full items-stretch overflow-x-auto">
        {WORKFLOW_STAGES.map((stage, i) => {
          const isActive = i === activeIndex
          const isDone = i < activeIndex
          return (
            <li key={stage.id} className="flex-1 min-w-[9rem]">
              <RepLink
                href={stage.href}
                className={cn(
                  "group relative flex h-full flex-col justify-center gap-0.5 px-4 py-2.5 transition-colors",
                  isActive
                    ? "bg-[var(--brand-nav-bg)] text-white"
                    : isDone
                      ? "bg-slate-200/70 text-slate-700 hover:bg-slate-200"
                      : "text-slate-500 hover:bg-slate-100",
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      isActive
                        ? "bg-white text-[var(--brand-nav-bg)]"
                        : isDone
                          ? "bg-slate-500 text-white"
                          : "bg-slate-300 text-slate-600",
                    )}
                  >
                    {isDone ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : stage.no}
                  </span>
                  <span className="text-xs font-semibold tracking-tight whitespace-nowrap">
                    {stage.label}
                  </span>
                </div>
                <span
                  className={cn(
                    "truncate text-[11px] leading-tight",
                    isActive ? "text-white/70" : "text-slate-400",
                  )}
                >
                  {stage.tasks.join(" / ")}
                </span>
              </RepLink>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
