"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ChartTooltip, getYAxisWidth } from "@/components/chart-utils"
import { EmptyState } from "@/components/ui-kit"

const SIGNAL_COLORS: Record<string, string> = {
  大量採用: "#1b4f8a",
  制度見直し: "#29b5e8",
  健康経営: "#0f9488",
  年金制度: "#6366f1",
  海外展開: "#f59e0b",
  高齢化対応: "#db2777",
  組織再編: "#7c3aed",
}

/** Meeting-quality score trend with meeting volume overlaid. */
export function QualityTrendChart({
  data,
}: {
  data: { month: string; qualityScore: number; meetings: number }[]
}) {
  if (!data.length) return <EmptyState message="表示できる商談データがありません。" />

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#64748b" }} tickMargin={6} />
        <YAxis
          yAxisId="left"
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: "#64748b" }}
          width={getYAxisWidth(data, "qualityScore")}
          label={{ value: "品質", angle: -90, position: "insideLeft", fontSize: 10, fill: "#94a3b8" }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          width={32}
        />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar yAxisId="right" dataKey="meetings" name="商談件数" fill="#cbd5e1" radius={[2, 2, 0, 0]} />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="qualityScore"
          name="商談品質スコア"
          stroke="#1b4f8a"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/** Job-posting signal mix — the input that drives the attack list. */
export function SignalMixChart({
  data,
}: {
  data: { signalType: string; companies: number; postings: number }[]
}) {
  if (!data.length) return <EmptyState message="直近180日の求人シグナルがありません。" />

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#e2e8f0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} />
        <YAxis
          type="category"
          dataKey="signalType"
          tick={{ fontSize: 10, fill: "#475569" }}
          width={78}
        />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="postings" name="求人件数" radius={[0, 3, 3, 0]}>
          {data.map((d) => (
            <Cell key={d.signalType} fill={SIGNAL_COLORS[d.signalType] ?? "#94a3b8"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Revenue and profit history for the customer 360 screen. */
export function FinancialTrendChart({
  data,
}: {
  data: { fiscalYear: number; revenue: number; operatingProfit: number; employeeCount: number }[]
}) {
  if (!data.length) return <EmptyState message="財務データがありません。" />
  const scaled = data.map((d) => ({
    year: `FY${d.fiscalYear}`,
    売上高: Math.round(d.revenue / 100000000),
    営業利益: Math.round(d.operatingProfit / 100000000),
    従業員数: d.employeeCount,
  }))

  return (
    <ResponsiveContainer width="100%" height={230}>
      <ComposedChart data={scaled} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="year" tick={{ fontSize: 10, fill: "#64748b" }} tickMargin={6} />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 10, fill: "#64748b" }}
          width={getYAxisWidth(scaled, "売上高")}
          label={{ value: "億円", angle: -90, position: "insideLeft", fontSize: 10, fill: "#94a3b8" }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          width={44}
        />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar yAxisId="left" dataKey="売上高" fill="#1b4f8a" radius={[2, 2, 0, 0]} />
        <Bar yAxisId="left" dataKey="営業利益" fill="#29b5e8" radius={[2, 2, 0, 0]} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="従業員数"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/** Monthly job-posting volume for a single company. */
export function JobPostingTrendChart({
  data,
}: {
  data: { month: string; postings: number; openings: number }[]
}) {
  if (!data.length) return <EmptyState message="求人データがありません。" />

  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#64748b" }} tickMargin={6} />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 10, fill: "#64748b" }}
          width={getYAxisWidth(data, "openings")}
        />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#94a3b8" }} width={30} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar yAxisId="left" dataKey="openings" name="募集人数" fill="#29b5e8" radius={[2, 2, 0, 0]} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="postings"
          name="求人件数"
          stroke="#1b4f8a"
          strokeWidth={2}
          dot={{ r: 2 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/** Skill-tier comparison used on the tacit-knowledge screen. */
export function TierComparisonChart({
  data,
}: {
  data: { skillTier: string; avgQuality: number; avgQuestions: number; winRate: number }[]
}) {
  if (!data.length) return <EmptyState message="比較データがありません。" />
  const order = ["トップ", "中堅", "若手"]
  const sorted = [...data].sort((a, b) => order.indexOf(a.skillTier) - order.indexOf(b.skillTier))
  const scaled = sorted.map((d) => ({
    tier: d.skillTier,
    商談品質スコア: d.avgQuality,
    成約率: Math.round(d.winRate * 100),
    ヒアリング質問数: d.avgQuestions,
  }))

  return (
    <ResponsiveContainer width="100%" height={210}>
      <ComposedChart data={scaled} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="tier" tick={{ fontSize: 11, fill: "#475569" }} tickMargin={6} />
        <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#64748b" }} width={34} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#94a3b8" }} width={30} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar yAxisId="left" dataKey="商談品質スコア" fill="#1b4f8a" radius={[2, 2, 0, 0]} />
        <Bar yAxisId="left" dataKey="成約率" fill="#29b5e8" radius={[2, 2, 0, 0]} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="ヒアリング質問数"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={{ r: 4 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
