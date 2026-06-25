import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCompanies } from "@/lib/companies";
import { Header } from "@/components/layout/Header";
import { formatCurrency, formatDate, dxStatusColor, statusLabel } from "@/lib/utils";
import { Users, FileText, TrendingUp, Clock } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { company?: string };
}) {
  const session = await getServerSession(authOptions);
  const company = searchParams.company ?? "";
  const quotationWhere = company ? { companyId: company } : {};

  const [companies, totalCustomers, totalQuotations, recentQuotations, statusCounts] =
    await Promise.all([
      getCompanies(),
      prisma.customer.count({ where: { isActive: true } }),
      prisma.quotation.count({ where: quotationWhere }),
      prisma.quotation.findMany({
        where: quotationWhere,
        take: 6,
        orderBy: { createdAt: "desc" },
        include: {
          customer: true,
          company: { select: { name: true } },
        },
      }),
      prisma.quotation.groupBy({
        by: ["status"],
        where: quotationWhere,
        _count: true,
        _sum: { totalAmount: true },
      }),
    ]);

  const companyHref = (id: string) => (id ? `/dashboard?company=${id}` : "/dashboard");
  const quotationsHref = (params: string) =>
    company ? `/quotations?company=${company}&${params}` : `/quotations?${params}`;

  const accepted = statusCounts.find((s) => s.status === "ACCEPTED");
  const draft = statusCounts.find((s) => s.status === "DRAFT");
  const sent = statusCounts.find((s) => s.status === "SENT");
  const rejected = statusCounts.find((s) => s.status === "REJECTED");

  const totalRevenue = accepted?._sum?.totalAmount ?? 0;
  const pendingCount = (draft?._count ?? 0) + (sent?._count ?? 0);

  const stats = [
    {
      title: "Total Customers",
      value: totalCustomers,
      icon: Users,
      tint: "from-[#A855F7] to-[#6366F1]",
      href: "/customers",
    },
    {
      title: "Total Quotations",
      value: totalQuotations,
      icon: FileText,
      tint: "from-[#0EA5E9] to-[#14B8A6]",
      href: company ? `/quotations?company=${company}` : "/quotations",
    },
    {
      title: "Accepted Value",
      value: formatCurrency(Number(totalRevenue)),
      icon: TrendingUp,
      tint: "from-[#10B981] to-[#84CC16]",
      href: quotationsHref("status=ACCEPTED"),
    },
    {
      title: "Pending (Draft + Sent)",
      value: pendingCount,
      icon: Clock,
      tint: "from-[#F59E0B] to-[#F97316]",
      href: quotationsHref("status=DRAFT"),
    },
  ];

  // Build donut chart segments for status breakdown
  const statusSegments = [
    { label: "Draft", count: draft?._count ?? 0, color: "#AEB9E1" },
    { label: "Sent", count: sent?._count ?? 0, color: "#00C2FF" },
    { label: "Accepted", count: accepted?._count ?? 0, color: "#14CA74" },
    { label: "Rejected", count: rejected?._count ?? 0, color: "#FF5A65" },
  ];
  const total = statusSegments.reduce((s, i) => s + i.count, 0);
  const r = 36;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const segments = statusSegments.map((seg) => {
    const dash = total > 0 ? (seg.count / total) * circ : 0;
    const gap = circ - dash;
    const o = offset;
    offset += dash;
    return { ...seg, dash, gap, offset: o };
  });

  return (
    <div className="flex flex-col flex-1">
      <Header
        title={`Good day, ${session?.user?.name?.split(" ")[0]} 👋`}
        subtitle="Here's what's happening with your business today."
      />

      <main className="flex-1 p-6 space-y-6">
        {/* Company filter */}
        {companies.length > 1 && (
          <div className="flex items-center gap-1 bg-dx-surface border border-dx-line rounded-xl p-1 w-fit">
            <Link
              href={companyHref("")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                !company
                  ? "bg-gradient-to-r from-dx-accent to-dx-accent-2 text-white"
                  : "text-dx-ink-muted hover:text-dx-ink hover:bg-dx-surface-hover"
              }`}
            >
              All companies
            </Link>
            {companies.map((co) => (
              <Link
                key={co.id}
                href={companyHref(co.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  company === co.id
                    ? "bg-gradient-to-r from-dx-accent to-dx-accent-2 text-white"
                    : "text-dx-ink-muted hover:text-dx-ink hover:bg-dx-surface-hover"
                }`}
              >
                {co.name}
              </Link>
            ))}
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Link
              href={stat.href}
              key={stat.title}
              className="dx-card p-4 flex items-center gap-3.5 hover:border-dx-accent/40 transition-colors"
            >
              <div
                className={`w-11 h-11 rounded-xl bg-gradient-to-br ${stat.tint} flex items-center justify-center flex-shrink-0 shadow-lg`}
              >
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-dx-ink-muted truncate">{stat.title}</p>
                <p className="text-xl font-semibold text-dx-ink mt-0.5">{stat.value}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Status breakdown + Recent quotations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Donut chart */}
          <div className="dx-card p-5">
            <h2 className="text-sm font-semibold text-dx-ink mb-4">Quotation Status</h2>

            <div className="flex items-center justify-center mb-5">
              <div className="relative">
                <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
                  <circle cx="48" cy="48" r={r} fill="none" stroke="#343B4F" strokeWidth="10" />
                  {total === 0 ? (
                    <circle cx="48" cy="48" r={r} fill="none" stroke="#343B4F" strokeWidth="10" />
                  ) : (
                    segments.map((seg, i) =>
                      seg.count > 0 ? (
                        <circle
                          key={i}
                          cx="48"
                          cy="48"
                          r={r}
                          fill="none"
                          stroke={seg.color}
                          strokeWidth="10"
                          strokeDasharray={`${seg.dash} ${seg.gap}`}
                          strokeDashoffset={-seg.offset}
                          strokeLinecap="round"
                        />
                      ) : null
                    )
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-dx-ink">{total}</span>
                  <span className="text-xs text-dx-ink-faint">Total</span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              {statusSegments.map((seg) => (
                <div key={seg.label} className="flex items-center gap-3">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: seg.color }}
                  />
                  <span className="text-xs text-dx-ink-muted flex-1">{seg.label}</span>
                  <div className="flex-1 h-1.5 bg-dx-line rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: total > 0 ? `${(seg.count / total) * 100}%` : "0%",
                        background: seg.color,
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-dx-ink w-5 text-right">
                    {seg.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent quotations */}
          <div className="dx-card lg:col-span-2 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dx-line">
              <h2 className="text-sm font-semibold text-dx-ink">Recent Quotations</h2>
              <Link href="/quotations" className="text-xs text-dx-accent hover:opacity-80 transition-opacity">
                View all
              </Link>
            </div>

            {recentQuotations.length === 0 ? (
              <p className="text-sm text-dx-ink-muted text-center py-10">
                No quotations yet.{" "}
                <Link href="/quotations/new" className="text-dx-accent hover:opacity-80">
                  Create one
                </Link>
                .
              </p>
            ) : (
              <div className="divide-y divide-dx-line">
                {recentQuotations.map((q) => (
                  <Link
                    key={q.id}
                    href={`/quotations/${q.id}`}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-dx-surface-hover transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-mono font-semibold text-dx-accent truncate">
                        {q.quotationNumber}
                      </p>
                      <p className="text-xs text-dx-ink-faint truncate">
                        {q.customer.name}
                        {!company && q.company ? ` · ${q.company.name}` : ""}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${dxStatusColor(q.status)}`}
                    >
                      {statusLabel(q.status)}
                    </span>
                    <span className="text-sm font-semibold text-dx-ink flex-shrink-0">
                      {formatCurrency(Number(q.totalAmount))}
                    </span>
                    <span className="text-xs text-dx-ink-faint hidden sm:block flex-shrink-0">
                      {formatDate(q.createdAt)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="dx-card p-5">
          <h2 className="text-sm font-semibold text-dx-ink mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/quotations/new" className="dx-btn-gradient">
              + New Quotation
            </Link>
            <Link href="/customers/new" className="dx-btn-ghost">
              + Add Customer
            </Link>
            <Link href="/quotations?status=SENT" className="dx-btn-ghost">
              View Sent Quotes
            </Link>
            <Link href="/reports" className="dx-btn-ghost">
              View Reports
            </Link>
            <Link href="/kanban" className="dx-btn-ghost">
              Kanban Board
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
