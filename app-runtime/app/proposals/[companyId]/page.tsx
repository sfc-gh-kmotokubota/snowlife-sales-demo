import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { getCustomerOverview, getProposals, getProposalStories } from "@/lib/queries"
import { formatNum } from "@/lib/format"
import { GradeBadge } from "@/components/ui-kit"
import { ProposalWorkspace } from "@/components/proposal-workspace"

export const dynamic = "force-dynamic"

export default async function ProposalCompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>
  searchParams: Promise<{ rep?: string }>
}) {
  const { companyId } = await params
  const { rep } = await searchParams

  const overview = await getCustomerOverview(companyId)
  if (!overview) notFound()

  const [stories, proposals] = await Promise.all([
    getProposalStories(companyId, null),
    getProposals(companyId, null),
  ])

  const href = (p: string) =>
    rep ? `${p}${p.includes("?") ? "&" : "?"}rep=${encodeURIComponent(rep)}` : p

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Link
          href={href("/proposals")}
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-slate-900"
        >
          <ArrowLeft className="h-3 w-3" />
          提案一覧に戻る
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <GradeBadge grade={overview.attack.grade} className="h-6 w-6 text-xs" />
          <h1 className="text-lg font-semibold tracking-tight">
            <Link
              href={href(`/customers/${overview.companyId}`)}
              className="hover:text-[var(--brand-primary)] hover:underline"
            >
              {overview.companyName}
            </Link>
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">
              提案ストーリー・提案書
            </span>
          </h1>
          <span className="text-xs text-muted-foreground">
            {overview.industryDetail} / 従業員 {formatNum(overview.employeeCount)}名 / 担当{" "}
            {overview.salesRepName}
          </span>
        </div>
      </div>

      <ProposalWorkspace
        overview={overview}
        initialStories={stories}
        initialProposals={proposals}
        repParam={rep ?? ""}
      />
    </div>
  )
}
