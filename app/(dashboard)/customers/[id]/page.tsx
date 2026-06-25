import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { formatCurrency, formatDate, dxStatusColor, statusLabel } from "@/lib/utils";
import Link from "next/link";

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: { quotations: { orderBy: { createdAt: "desc" }, take: 10 } },
  });
  if (!customer) notFound();

  return (
    <div className="flex flex-col flex-1">
      <Header title={customer.name} subtitle="Customer details & quotation history" />
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        <div className="lg:col-span-3">
          <CustomerForm
            customerId={customer.id}
            defaultValues={{
              name: customer.name,
              contactPerson: customer.contactPerson ?? "",
              email: customer.email ?? "",
              phone: customer.phone ?? "",
              address: customer.address ?? "",
              city: customer.city ?? "",
              notes: customer.notes ?? "",
            }}
          />
        </div>

        <div className="lg:col-span-2 dx-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-dx-line">
            <h3 className="text-sm font-semibold text-dx-ink">Quotation History</h3>
            <Link href={`/quotations/new?customerId=${customer.id}`} className="text-xs text-dx-accent hover:opacity-80 font-medium">
              + New Quote
            </Link>
          </div>
          {customer.quotations.length === 0 ? (
            <p className="text-sm text-dx-ink-muted py-8 text-center">No quotations yet.</p>
          ) : (
            <div className="divide-y divide-dx-line">
              {customer.quotations.map((q) => (
                <Link
                  key={q.id}
                  href={`/quotations/${q.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-dx-surface-hover transition-colors"
                >
                  <div>
                    <p className="text-sm font-mono font-semibold text-dx-accent">{q.quotationNumber}</p>
                    <p className="text-xs text-dx-ink-faint">{formatDate(q.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${dxStatusColor(q.status)}`}>
                      {statusLabel(q.status)}
                    </span>
                    <span className="text-xs font-semibold text-dx-ink">{formatCurrency(Number(q.totalAmount))}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
