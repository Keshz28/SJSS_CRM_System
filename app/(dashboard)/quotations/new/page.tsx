import { prisma } from "@/lib/prisma";
import { getCompanyScope } from "@/lib/company-scope";
import { Header } from "@/components/layout/Header";
import { QuotationForm } from "@/components/quotations/QuotationForm";

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: { customerId?: string };
}) {
  const [customers, { companies, companyId }] = await Promise.all([
    prisma.customer.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, contactPerson: true },
    }),
    getCompanyScope(),
  ]);

  return (
    <div className="flex flex-col flex-1">
      <Header title="New Quotation" subtitle="Create a new quotation for a customer" />
      <main className="flex-1 p-4 sm:p-6">
        <QuotationForm
          customers={customers}
          companies={companies}
          defaultCompanyId={companyId}
          preselectedCustomerId={searchParams.customerId}
        />
      </main>
    </div>
  );
}
