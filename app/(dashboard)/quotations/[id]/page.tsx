import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { QuotationDetail } from "@/components/quotations/QuotationDetail";

export default async function QuotationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const quotation = await prisma.quotation.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      company: { select: { id: true, name: true, prefix: true } },
      items: { orderBy: { order: "asc" } },
      attachments: { orderBy: { uploadedAt: "desc" } },
      createdBy: { select: { name: true } },
    },
    // invoiceNumber + invoicedAt are plain fields, included automatically
  });

  if (!quotation) notFound();

  return (
    <div className="flex flex-col flex-1">
      <Header
        title={quotation.quotationNumber}
        subtitle={`${quotation.customer.name} — ${quotation.subject ?? "No subject"}`}
      />
      <main className="flex-1 p-6">
        <QuotationDetail quotation={JSON.parse(JSON.stringify(quotation))} />
      </main>
    </div>
  );
}
