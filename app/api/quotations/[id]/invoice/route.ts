import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params: pendingParams }: { params: Promise<{ id: string }> },
) {
  const params = await pendingParams;
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM quotations WHERE id = ${params.id} FOR UPDATE`;
    const quotation = await tx.quotation.findUnique({ where: { id: params.id } });
    if (!quotation) return { error: "Not found", status: 404 };
    if (quotation.createdById !== session.user.id && session.user.role !== "ADMIN")
      return { error: "Only the creator or an administrator can create this invoice.", status: 403 };
    if (quotation.status !== "ACCEPTED") return { error: "Only accepted quotes can be converted to invoices.", status: 400 };
    // Retried conversions return the existing invoice instead of issuing another.
    if (quotation.invoiceNumber) return { invoiceNumber: quotation.invoiceNumber, invoicedAt: quotation.invoicedAt };
    const year = Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Kuala_Lumpur", year: "numeric" }).format(new Date()));
    const sequence = await tx.invoiceSequence.upsert({
      where: { year }, create: { year, value: 1 }, update: { value: { increment: 1 } },
    });
    const updated = await tx.quotation.update({ where: { id: params.id }, data: {
      invoiceNumber: `INV-${year}-${String(sequence.value).padStart(4, "0")}`, invoicedAt: new Date(),
    } });
    return { invoiceNumber: updated.invoiceNumber, invoicedAt: updated.invoicedAt };
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
