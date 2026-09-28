"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown, Users } from "lucide-react"
import type { SalesRep } from "@/lib/queries"

/**
 * Sales-rep switcher. The selected rep is carried in the `rep` query parameter
 * so every server component and API route can scope its data without needing
 * client state or row-access policies.
 */
export function RepSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const current = params.get("rep") ?? ""

  const { data: reps = [], isLoading } = useQuery<SalesRep[]>({
    queryKey: ["reps"],
    queryFn: async () => {
      const res = await fetch("/api/reps")
      if (!res.ok) throw new Error("営業員の取得に失敗しました")
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  const onChange = useCallback(
    (repId: string) => {
      const next = new URLSearchParams(params.toString())
      if (repId) next.set("rep", repId)
      else next.delete("rep")
      router.push(`${pathname}?${next.toString()}`)
    },
    [params, pathname, router],
  )

  const selected = reps.find((r) => r.repId === current)

  return (
    <div className="flex items-center gap-2">
      <Users className="h-4 w-4 text-white/70 shrink-0" aria-hidden />
      <div className="relative">
        <select
          value={current}
          onChange={(e) => onChange(e.target.value)}
          disabled={isLoading}
          aria-label="担当営業員を切り替え"
          className="appearance-none bg-white/10 border border-white/20 text-white text-xs rounded-md
                     pl-2.5 pr-7 py-1.5 focus:outline-none focus:ring-2 focus:ring-white/40
                     disabled:opacity-50 min-w-[9.5rem] cursor-pointer"
        >
          <option value="" className="text-slate-900">
            全営業員
          </option>
          {reps.map((r) => (
            <option key={r.repId} value={r.repId} className="text-slate-900">
              {r.name}（{r.skillTier}）
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/70"
          aria-hidden
        />
      </div>
      {selected && (
        <span className="hidden lg:inline text-[12px] text-white/60 tabular-nums">
          担当 {selected.companyCount}社 / 成約率 {Math.round(selected.winRate * 100)}%
        </span>
      )}
    </div>
  )
}

/** Preserve the current `rep` param when navigating. */
export function useRepHref() {
  const params = useSearchParams()
  const rep = params.get("rep")
  return useCallback(
    (href: string) => {
      if (!rep) return href
      const [path, existing] = href.split("?")
      const q = new URLSearchParams(existing ?? "")
      q.set("rep", rep)
      return `${path}?${q.toString()}`
    },
    [rep],
  )
}

/** Link that automatically carries the active rep selection. */
export function RepLink({
  href,
  children,
  className,
}: {
  href: string
  children: React.ReactNode
  className?: string
}) {
  const withRep = useRepHref()
  return (
    <Link href={withRep(href)} className={className}>
      {children}
    </Link>
  )
}
