"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, FileText, CheckCircle, XCircle, Download } from "lucide-react";
import {
  buildPeriodBuckets,
  periodNoun,
  REPORT_PERIODS,
  type QuotationPoint,
  type ReportPeriod,
} from "@/lib/report-periods";

interface Props {
  companyId: string;
  companyName: string;
  series: QuotationPoint[];
  totalRevenue: number;
  totalQuotes: number;
  acceptedCount: number;
  rejectedCount: number;
  draftCount: number;
  sentCount: number;
  topCustomers: { id: string; name: string; companyName: string; total: number; count: number }[];
}

const PERIOD_LABELS: Record<ReportPeriod, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

const STATUS_PIE = [
  { name: "Draft", color: "var(--dx-ink-muted)" },
  { name: "Sent", color: "var(--dx-accent)" },
  { name: "Accepted", color: "var(--dx-success)" },
  { name: "Rejected", color: "var(--dx-danger)" },
];

const TOOLTIP_STYLE = {
  backgroundColor: "var(--dx-surface)",
  border: "1px solid var(--dx-line)",
  borderRadius: "12px",
  color: "var(--dx-ink)",
  fontSize: 12,
};

export function ReportsClient({
  companyId, companyName, series, totalRevenue, totalQuotes, acceptedCount, rejectedCount, draftCount, sentCount, topCustomers,
}: Props) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [period, setPeriod] = useState<ReportPeriod>("monthly");
  const periodData = useMemo(() => buildPeriodBuckets(series, period), [series, period]);
  const noun = periodNoun(period);

  const acceptanceRate = totalQuotes > 0 ? Math.round((acceptedCount / totalQuotes) * 100) : 0;

  const pieData = [
    { name: "Draft", value: draftCount },
    { name: "Sent", value: sentCount },
    { name: "Accepted", value: acceptedCount },
    { name: "Rejected", value: rejectedCount },
  ].filter((d) => d.value > 0);

  const statCards = [
    { label: "Accepted Quotation Value", value: formatCurrency(totalRevenue), icon: TrendingUp, tint: "from-[#15803D] to-[#166534]" },
    { label: "Total Quotations", value: totalQuotes, icon: FileText, tint: "from-[#0369A1] to-[#075985]" },
    { label: "Acceptance Rate", value: `${acceptanceRate}%`, icon: CheckCircle, tint: "from-[#1D4ED8] to-[#2459B7]" },
    { label: "Rejected Quotes", value: rejectedCount, icon: XCircle, tint: "from-[#B45309] to-[#92400E]" },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-dx-ink-muted">{companyName} · Summary totals cover all time. Charts show the last {period === "yearly" ? "5 years" : period === "weekly" ? "12 weeks" : "12 months"} in Malaysia time. Values are accepted quotations, not payments received.</p>
      {/* Toolbar: period selector + admin PDF export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-dx-line bg-dx-surface p-1">
          {REPORT_PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                period === p
                  ? "bg-dx-action text-white shadow-sm"
                  : "text-dx-ink-muted hover:text-dx-ink"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {isAdmin && (
          <a
            href={`/api/reports/pdf?period=${period}&company=${encodeURIComponent(companyId)}`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-dx-action text-white hover:opacity-90 transition-opacity shadow-sm"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </a>
        )}
      </div>

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
          <h2 className="text-sm font-semibold text-dx-ink mb-5">{noun} Accepted Quotation Value</h2>
          {periodData.length === 0 ? (
            <p className="text-dx-ink-muted text-sm text-center py-10">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={periodData} barCategoryGap="30%">
                <XAxis dataKey="label" tick={{ fill: "var(--dx-ink-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--dx-ink-muted)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `RM${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v) => [formatCurrency(Number(v)), "Accepted value"]}
                  cursor={{ fill: "rgb(var(--dx-accent-rgb) / 0.08)" }}
                />
                <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                  {periodData.map((_, i) => (
                    <Cell key={i} fill={i === periodData.length - 1 ? "var(--dx-accent)" : "var(--dx-accent-2)"} />
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
                    <Cell key={i} fill={STATUS_PIE.find((s) => s.name === entry.name)?.color ?? "var(--dx-ink-muted)"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11, color: "var(--dx-ink-muted)" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Monthly quote volume */}
      <div className="dx-card p-5">
        <h2 className="text-sm font-semibold text-dx-ink mb-5">{noun} Quote Volume</h2>
        {periodData.length === 0 ? (
          <p className="text-dx-ink-muted text-sm text-center py-8">No data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={periodData} barCategoryGap="35%">
              <XAxis dataKey="label" tick={{ fill: "var(--dx-ink-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--dx-ink-muted)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [Number(v), "Quotes"]} cursor={{ fill: "rgb(var(--dx-accent-rgb) / 0.08)" }} />
              <Bar dataKey="quotes" fill="#A855F7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top customers */}
      <div className="dx-card overflow-hidden">
        <div className="px-5 py-4 border-b border-dx-line">
          <h2 className="text-sm font-semibold text-dx-ink">Top Customers by Accepted Value</h2>
        </div>
        {topCustomers.length === 0 ? (
          <p className="text-dx-ink-muted text-sm text-center py-8">No data yet.</p>
        ) : (
          <div className="divide-y divide-dx-line">
            {topCustomers.map((c, i) => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-3">
                <span className="w-6 text-xs font-bold text-dx-ink-faint text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dx-ink truncate">{c.name}</p>
                  <p className="text-xs text-dx-ink-faint">{!companyId ? `${c.companyName} · ` : ""}{c.count} quote{c.count !== 1 ? "s" : ""}</p>
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
