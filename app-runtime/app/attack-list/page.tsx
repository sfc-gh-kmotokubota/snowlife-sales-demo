import { Suspense } from "react"
import { AttackListClient } from "@/components/attack-list-client"

export const dynamic = "force-dynamic"

export default function AttackListPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-xs text-muted-foreground">読み込み中…</div>
      }
    >
      <AttackListClient />
    </Suspense>
  )
}
