import { prisma } from "@/lib/prisma";
import { getCompanyScope, customerScopeWhere } from "@/lib/company-scope";
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

  const { companyId } = await getCompanyScope();
  // When a company is selected, narrow to customers that have done business
  // with it. Customers are shared, so "All companies" shows everyone.
  const scope = customerScopeWhere(companyId);
  const hasScope = !!companyId;

  // The "has a quotation" filter respects the company scope too.
  const someQuotation = hasScope ? { some: { companyId } } : { some: {} };
  // Per-customer quote count: scoped to the selected company when one is active.
  const quotationCount = hasScope
    ? { select: { quotations: { where: { companyId } } } }
    : { select: { quotations: true } };

  const searchOr = search
    ? [
        { name: { contains: search, mode: "insensitive" as const } },
        { contactPerson: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
        { phone: { contains: search, mode: "insensitive" as const } },
      ]
    : null;

  // Combine: active + (company scope) + (search). Use AND so the OR clauses
  // from scope and search don't collide.
  const andClauses: Record<string, unknown>[] = [];
  if (hasScope) andClauses.push(scope);
  if (searchOr) andClauses.push({ OR: searchOr });
  const where = {
    isActive: true,
    ...(andClauses.length ? { AND: andClauses } : {}),
  };

  const scopedActive = { isActive: true, ...scope };

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
        include: { _count: quotationCount },
      }),
      prisma.customer.count({ where }),
      prisma.customer.count({ where: scopedActive }),
      prisma.customer.count({
        where: { isActive: true, quotations: someQuotation },
      }),
      prisma.quotation.count({ where: hasScope ? { companyId } : {} }),
      prisma.customer.count({
        where: { ...scopedActive, createdAt: { gte: startOfMonth } },
      }),
    ]);

  return (
    <div className="flex flex-col flex-1">
      <Header
        title="Customers"
        subtitle={`${total} customer${total !== 1 ? "s" : ""} total`}
      />
      <main className="flex-1 p-4 sm:p-6">
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
