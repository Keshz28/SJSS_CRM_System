import { prisma } from "@/lib/prisma";
import { getCompanies } from "@/lib/companies";
import { Header } from "@/components/layout/Header";
import { QuotationForm } from "@/components/quotations/QuotationForm";

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: { customerId?: string };
}) {
  const [customers, companies] = await Promise.all([
    prisma.customer.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, contactPerson: true },
    }),
    getCompanies(),
  ]);

  return (
    <div className="flex flex-col flex-1">
      <Header title="New Quotation" subtitle="Create a new quotation for a customer" />
      <main className="flex-1 p-6">
        <QuotationForm
          customers={customers}
          companies={companies}
          preselectedCustomerId={searchParams.customerId}
        />
      </main>
    </div>
  );
}
