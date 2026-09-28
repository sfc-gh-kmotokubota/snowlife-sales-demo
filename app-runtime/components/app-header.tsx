"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Suspense } from "react"
import { APP_SUBTITLE, APP_TITLE, LOGO_SRC } from "@/lib/constants"
import { RepLink, RepSwitcher } from "@/components/rep-switcher"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/", label: "ダッシュボード" },
  { href: "/attack-list", label: "アタックリスト" },
  { href: "/customers", label: "顧客情報" },
  { href: "/meetings", label: "商談・振り返り" },
  { href: "/knowledge", label: "暗黙知" },
  { href: "/proposals", label: "提案ストーリー・提案書" },
] as const

/**
 * AppHeader — brand bar with primary navigation and the sales-rep switcher.
 * Sticky so the rep context stays visible while scrolling long tables.
 */
export function AppHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full bg-[var(--brand-nav-bg)] text-white">
      <div className="flex h-14 w-full items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          {LOGO_SRC && (
            <Image src={LOGO_SRC} alt={`${APP_TITLE} logo`} width={26} height={26} priority />
          )}
          <span className="flex flex-col leading-none">
            <span className="text-sm font-semibold tracking-tight">{APP_TITLE}</span>
            <span className="text-[11px] text-white/60">{APP_SUBTITLE}</span>
          </span>
        </Link>

        <nav aria-label="主要メニュー" className="ml-2 hidden items-center gap-0.5 md:flex">
          {NAV.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
            return (
              <RepLink
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                  active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white",
                )}
              >
                {item.label}
              </RepLink>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Suspense fallback={null}>
            <RepSwitcher />
          </Suspense>
        </div>
      </div>
    </header>
  )
}
