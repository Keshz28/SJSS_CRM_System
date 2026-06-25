import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quotation = await prisma.quotation.findUnique({
    where: { id: params.id },
    select: { id: true, status: true, invoiceNumber: true, companyId: true },
  });

  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (quotation.status !== "ACCEPTED") return NextResponse.json({ error: "Only accepted quotes can be converted to invoices." }, { status: 400 });
  if (quotation.invoiceNumber) return NextResponse.json({ error: "Already has an invoice." }, { status: 400 });

  // Generate invoice number: INV-YYYY-XXXX (global sequence per company using a simple count)
  const year = new Date().getFullYear();
  const existing = await prisma.quotation.count({
    where: { invoiceNumber: { startsWith: `INV-${year}-` } },
  });
  const seq = String(existing + 1).padStart(4, "0");
  const invoiceNumber = `INV-${year}-${seq}`;

  const updated = await prisma.quotation.update({
    where: { id: params.id },
    data: { invoiceNumber, invoicedAt: new Date() },
  });

  return NextResponse.json({ invoiceNumber: updated.invoiceNumber, invoicedAt: updated.invoicedAt });
}
