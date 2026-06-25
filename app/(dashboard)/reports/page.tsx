import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/Header";
import { ReportsClient } from "./ReportsClient";

export default async function ReportsPage() {
  const [statusCounts, allQuotations, customerRevenue] = await Promise.all([
    prisma.quotation.groupBy({
      by: ["status"],
      _count: true,
      _sum: { totalAmount: true },
    }),
    prisma.quotation.findMany({
      select: { createdAt: true, totalAmount: true, status: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.quotation.groupBy({
      by: ["customerId"],
      where: { status: "ACCEPTED" },
      _sum: { totalAmount: true },
      _count: true,
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 8,
    }),
  ]);

  const customerIds = customerRevenue.map((r) => r.customerId);
  const customerNames = await prisma.customer.findMany({
    where: { id: { in: customerIds } },
    select: { id: true, name: true },
  });
  const nameMap = Object.fromEntries(customerNames.map((c) => [c.id, c.name]));

  const topCustomers = customerRevenue.map((r) => ({
    name: nameMap[r.customerId] ?? "Unknown",
    total: Number(r._sum.totalAmount ?? 0),
    count: r._count,
  }));

  // Raw time series — the client buckets this by the selected period (weekly/monthly/yearly)
  const series = allQuotations.map((q) => ({
    createdAt: q.createdAt.toISOString(),
    totalAmount: Number(q.totalAmount),
    status: q.status,
  }));

  const accepted = statusCounts.find((s) => s.status === "ACCEPTED");
  const draft = statusCounts.find((s) => s.status === "DRAFT");
  const sent = statusCounts.find((s) => s.status === "SENT");
  const rejected = statusCounts.find((s) => s.status === "REJECTED");
  const totalQuotes = statusCounts.reduce((s, i) => s + i._count, 0);

  return (
    <div className="flex flex-col flex-1">
      <Header title="Reports & Analytics" subtitle="Business performance overview" />
      <main className="flex-1 p-6">
        <ReportsClient
          series={series}
          totalRevenue={Number(accepted?._sum?.totalAmount ?? 0)}
          totalQuotes={totalQuotes}
          acceptedCount={accepted?._count ?? 0}
          rejectedCount={rejected?._count ?? 0}
          draftCount={draft?._count ?? 0}
          sentCount={sent?._count ?? 0}
          topCustomers={topCustomers}
        />
      </main>
    </div>
  );
}
