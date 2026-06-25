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

  // Build last 12 months data
  const monthlyMap: Record<string, { revenue: number; quotes: number }> = {};
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleDateString("en-MY", { month: "short", year: "2-digit" });
    monthlyMap[key] = { revenue: 0, quotes: 0 };
  }

  allQuotations.forEach((q) => {
    const d = new Date(q.createdAt);
    const key = d.toLocaleDateString("en-MY", { month: "short", year: "2-digit" });
    if (monthlyMap[key]) {
      monthlyMap[key].quotes += 1;
      if (q.status === "ACCEPTED") {
        monthlyMap[key].revenue += Number(q.totalAmount);
      }
    }
  });

  const monthlyData = Object.entries(monthlyMap).map(([month, data]) => ({ month, ...data }));

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
          monthlyData={monthlyData}
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
