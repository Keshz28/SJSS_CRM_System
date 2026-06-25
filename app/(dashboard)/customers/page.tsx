import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/Header";
import { CustomerList } from "@/components/customers/CustomerList";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { search?: string; page?: string };
}) {
  const search = searchParams.search ?? "";
  const page = parseInt(searchParams.page ?? "1");
  const limit = 20;
  const skip = (page - 1) * limit;

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { contactPerson: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search, mode: "insensitive" as const } },
        ],
        isActive: true,
      }
    : { isActive: true };

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [customers, total, allCustomers, withQuotes, totalQuotes, newThisMonth] =
    await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { _count: { select: { quotations: true } } },
      }),
      prisma.customer.count({ where }),
      prisma.customer.count({ where: { isActive: true } }),
      prisma.customer.count({
        where: { isActive: true, quotations: { some: {} } },
      }),
      prisma.quotation.count(),
      prisma.customer.count({
        where: { isActive: true, createdAt: { gte: startOfMonth } },
      }),
    ]);

  return (
    <div className="flex flex-col flex-1">
      <Header
        title="Customers"
        subtitle={`${total} customer${total !== 1 ? "s" : ""} total`}
      />
      <main className="flex-1 p-6">
        <CustomerList
          customers={customers}
          total={total}
          page={page}
          limit={limit}
          search={search}
          stats={{
            totalCustomers: allCustomers,
            withQuotes,
            totalQuotes,
            newThisMonth,
          }}
        />
      </main>
    </div>
  );
}
