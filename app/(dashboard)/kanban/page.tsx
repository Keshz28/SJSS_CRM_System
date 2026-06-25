import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/Header";
import { KanbanClient } from "./KanbanClient";
import Link from "next/link";
import { Plus } from "lucide-react";

const SELECT = {
  id: true, quotationNumber: true, subject: true,
  totalAmount: true, createdAt: true,
  customer: { select: { name: true } },
  company: { select: { name: true } },
};

export default async function KanbanPage() {
  const [draft, sent, accepted, rejected] = await Promise.all([
    prisma.quotation.findMany({ where: { status: "DRAFT" }, select: SELECT, orderBy: { createdAt: "desc" } }),
    prisma.quotation.findMany({ where: { status: "SENT" }, select: SELECT, orderBy: { createdAt: "desc" } }),
    prisma.quotation.findMany({ where: { status: "ACCEPTED" }, select: SELECT, orderBy: { createdAt: "desc" } }),
    prisma.quotation.findMany({ where: { status: "REJECTED" }, select: SELECT, orderBy: { createdAt: "desc" } }),
  ]);

  function serialize<T extends { totalAmount: unknown; createdAt: Date | string }>(rows: T[]) {
    return rows.map((r) => ({ ...r, totalAmount: Number(r.totalAmount), createdAt: new Date(r.createdAt).toISOString() }));
  }

  return (
    <div className="flex flex-col flex-1">
      <Header title="Kanban Pipeline" subtitle="Drag quotations through your sales pipeline" />
      <main className="flex-1 p-6 space-y-5">
        <div className="flex justify-end">
          <Link href="/quotations/new" className="dx-btn-gradient">
            <Plus className="w-4 h-4" />
            New Quotation
          </Link>
        </div>
        <KanbanClient
          draft={serialize(draft)}
          sent={serialize(sent)}
          accepted={serialize(accepted)}
          rejected={serialize(rejected)}
        />
      </main>
    </div>
  );
}
