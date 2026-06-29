import { prisma } from "@/lib/prisma";
import { getCompanyScope } from "@/lib/company-scope";
import { Header } from "@/components/layout/Header";
import { QuotationList } from "@/components/quotations/QuotationList";

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: { search?: string; status?: string; page?: string };
}) {
  const search = searchParams.search ?? "";
  const status = searchParams.status ?? "";
  const { companyId: company, companies } = await getCompanyScope();
  const page = parseInt(searchParams.page ?? "1");
  const limit = 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (company) where.companyId = company;
  if (search) {
    where.OR = [
      { quotationNumber: { contains: search, mode: "insensitive" } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { subject: { contains: search, mode: "insensitive" } },
    ];
  }

  const [quotations, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        customer: true,
        company: { select: { id: true, name: true, prefix: true } },
        _count: { select: { items: true, attachments: true } },
      },
    }),
    prisma.quotation.count({ where }),
  ]);

  // Show the Company column only in the combined ("All companies") view.
  const showCompanyColumn = !company && companies.length > 1;

  return (
    <div className="flex flex-col flex-1">
      <Header title="Quotations" subtitle={`${total} quotation${total !== 1 ? "s" : ""} total`} />
      <main className="flex-1 p-4 sm:p-6">
        <QuotationList
          quotations={quotations}
          total={total}
          page={page}
          limit={limit}
          search={search}
          status={status}
          showCompanyColumn={showCompanyColumn}
        />
      </main>
    </div>
  );
}
