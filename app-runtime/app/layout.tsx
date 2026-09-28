import type { Metadata } from "next"
import type React from "react"
import { Suspense } from "react"
import { AppHeader } from "@/components/app-header"
import { WorkflowStepper } from "@/components/workflow-stepper"
import { QueryProvider } from "@/components/query-provider"
import { APP_TITLE, LOGO_SRC } from "@/lib/constants"
import "./globals.css"

export const metadata: Metadata = {
  title: `${APP_TITLE} | スノー生命`,
  description:
    "求人シグナル・CRM・暗黙知を統合し、お客様選定から提案書作成までを支援する法人営業AIアプリ",
  icons: { icon: LOGO_SRC },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        <QueryProvider>
          <Suspense fallback={<div className="h-14 bg-[var(--brand-nav-bg)]" />}>
            <AppHeader />
          </Suspense>
          <Suspense fallback={<div className="h-14 border-b border-border bg-slate-50" />}>
            <WorkflowStepper />
          </Suspense>
          <main className="mx-auto w-full max-w-[1600px] px-4 py-5">{children}</main>
          <footer className="border-t border-border px-4 py-3 text-[12px] text-muted-foreground">
            本アプリはデモ用です。保険会社「スノー生命」は架空であり、顧客企業の財務・求人・商談データはすべてデモ用に生成された架空データです。
          </footer>
        </QueryProvider>
      </body>
    </html>
  )
}
