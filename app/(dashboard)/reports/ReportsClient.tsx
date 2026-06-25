"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, FileText, CheckCircle, XCircle } from "lucide-react";

interface MonthlyData { month: string; revenue: number; quotes: number }

interface Props {
  monthlyData: MonthlyData[];
  totalRevenue: number;
  totalQuotes: number;
  acceptedCount: number;
  rejectedCount: number;
  draftCount: number;
  sentCount: number;
  topCustomers: { name: string; total: number; count: number }[];
}

const STATUS_PIE = [
  { name: "Draft", color: "#AEB9E1" },
  { name: "Sent", color: "#00C2FF" },
  { name: "Accepted", color: "#14CA74" },
  { name: "Rejected", color: "#FF5A65" },
];

const TOOLTIP_STYLE = {
  backgroundColor: "#0B1739",
  border: "1px solid #343B4F",
  borderRadius: "12px",
  color: "#FFFFFF",
  fontSize: 12,
};

export function ReportsClient({
  monthlyData, totalRevenue, totalQuotes, acceptedCount, rejectedCount, draftCount, sentCount, topCustomers,
}: Props) {
  const acceptanceRate = totalQuotes > 0 ? Math.round((acceptedCount / totalQuotes) * 100) : 0;

  const pieData = [
    { name: "Draft", value: draftCount },
    { name: "Sent", value: sentCount },
    { name: "Accepted", value: acceptedCount },
    { name: "Rejected", value: rejectedCount },
  ].filter((d) => d.value > 0);

  const statCards = [
    { label: "Total Revenue (Accepted)", value: formatCurrency(totalRevenue), icon: TrendingUp, tint: "from-[#10B981] to-[#84CC16]" },
    { label: "Total Quotations", value: totalQuotes, icon: FileText, tint: "from-[#0EA5E9] to-[#14B8A6]" },
    { label: "Acceptance Rate", value: `${acceptanceRate}%`, icon: CheckCircle, tint: "from-[#A855F7] to-[#6366F1]" },
    { label: "Rejected Quotes", value: rejectedCount, icon: XCircle, tint: "from-[#F59E0B] to-[#F97316]" },
  ];

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="dx-card p-4 flex items-center gap-3.5">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.tint} flex items-center justify-center flex-shrink-0 shadow-lg`}>
              <s.icon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-dx-ink-muted truncate">{s.label}</p>
              <p className="text-xl font-semibold text-dx-ink mt-0.5">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly revenue bar chart */}
        <div className="dx-card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-dx-ink mb-5">Monthly Revenue (Accepted Quotes)</h2>
          {monthlyData.length === 0 ? (
            <p className="text-dx-ink-muted text-sm text-center py-10">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData} barCategoryGap="30%">
                <XAxis dataKey="month" tick={{ fill: "#7E89AC", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#7E89AC", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `RM${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v) => [formatCurrency(Number(v)), "Revenue"]}
                  cursor={{ fill: "rgba(203,60,255,0.06)" }}
                />
                <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                  {monthlyData.map((_, i) => (
                    <Cell key={i} fill={i === monthlyData.length - 1 ? "#CB3CFF" : "#00C2FF"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status pie */}
        <div className="dx-card p-5">
          <h2 className="text-sm font-semibold text-dx-ink mb-5">Quote Status Breakdown</h2>
          {pieData.length === 0 ? (
            <p className="text-dx-ink-muted text-sm text-center py-10">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={STATUS_PIE.find((s) => s.name === entry.name)?.color ?? "#AEB9E1"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#AEB9E1" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Monthly quote volume */}
      <div className="dx-card p-5">
        <h2 className="text-sm font-semibold text-dx-ink mb-5">Monthly Quote Volume</h2>
        {monthlyData.length === 0 ? (
          <p className="text-dx-ink-muted text-sm text-center py-8">No data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={monthlyData} barCategoryGap="35%">
              <XAxis dataKey="month" tick={{ fill: "#7E89AC", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#7E89AC", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [Number(v), "Quotes"]} cursor={{ fill: "rgba(203,60,255,0.06)" }} />
              <Bar dataKey="quotes" fill="#A855F7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top customers */}
      <div className="dx-card overflow-hidden">
        <div className="px-5 py-4 border-b border-dx-line">
          <h2 className="text-sm font-semibold text-dx-ink">Top Customers by Revenue</h2>
        </div>
        {topCustomers.length === 0 ? (
          <p className="text-dx-ink-muted text-sm text-center py-8">No data yet.</p>
        ) : (
          <div className="divide-y divide-dx-line">
            {topCustomers.map((c, i) => (
              <div key={c.name} className="flex items-center gap-4 px-5 py-3">
                <span className="w-6 text-xs font-bold text-dx-ink-faint text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dx-ink truncate">{c.name}</p>
                  <p className="text-xs text-dx-ink-faint">{c.count} quote{c.count !== 1 ? "s" : ""}</p>
                </div>
                <span className="text-sm font-semibold text-dx-accent">{formatCurrency(c.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
