import { prisma } from "@/lib/prisma";
import { getCompanies } from "@/lib/companies";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { QuotationForm } from "@/components/quotations/QuotationForm";

export default async function EditQuotationPage({
  params: pendingParams,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = await pendingParams;
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const [quotation, customers, companies] = await Promise.all([
    prisma.quotation.findUnique({
      where: { id: params.id },
      include: { items: { orderBy: { order: "asc" } } },
    }),
    prisma.customer.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, contactPerson: true, companyId: true },
    }),
    getCompanies(),
  ]);

  if (!quotation) notFound();
  if (quotation.createdById !== session.user.id && session.user.role !== "ADMIN") redirect(`/quotations/${quotation.id}`);

  return (
    <div className="flex flex-col flex-1">
      <Header
        title={`Edit ${quotation.quotationNumber}`}
        subtitle="Update quotation details"
      />
      <main className="flex-1 p-4 sm:p-6">
        <QuotationForm
          customers={customers}
          companies={companies}
          defaultValues={{
            id: quotation.id,
            quotationNumber: quotation.quotationNumber,
            customerId: quotation.customerId,
            companyId: quotation.companyId ?? "",
            subject: quotation.subject ?? "",
            notes: quotation.notes ?? "",
            terms: quotation.terms ?? "",
            validUntil: quotation.validUntil?.toISOString() ?? "",
            status: quotation.status,
            items: quotation.items.map((item) => ({
              id: item.id,
              description: item.description,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
              order: item.order,
            })),
          }}
        />
      </main>
    </div>
  );
}
