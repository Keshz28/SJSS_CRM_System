import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateQuotationNumber } from "@/lib/quotation-number";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const visit = await prisma.siteVisit.findUnique({
    where: { id: params.id },
    include: { attachments: true, customer: true },
  });

  if (!visit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (visit.quotationId) {
    return NextResponse.json(
      { error: "This visit has already been converted to a quotation." },
      { status: 400 }
    );
  }
  if (!visit.companyId) {
    return NextResponse.json({ error: "Visit has no company set." }, { status: 400 });
  }

  // Resolve the customer: use the linked one, or auto-create from the loose
  // contact details captured for a new prospect.
  let customerId = visit.customerId;
  if (!customerId) {
    const name = visit.contactName?.trim() || visit.title.trim() || "New prospect";
    const customer = await prisma.customer.create({
      data: {
        name,
        phone: visit.contactPhone || null,
        address: visit.location || null,
      },
    });
    customerId = customer.id;
  }

  const quotationNumber = await generateQuotationNumber(visit.companyId);

  // Carry the site-visit notes into the quote for reference at the desk.
  const notes = visit.notes?.trim() || null;

  const quotation = await prisma.quotation.create({
    data: {
      quotationNumber,
      customerId,
      companyId: visit.companyId,
      subject: visit.title,
      notes,
      totalAmount: 0,
      status: "DRAFT",
      createdById: session.user.id,
    },
  });

  // Move the captured photos onto the new quotation, then link + flag the visit.
  // The files stay on disk where they are; only the DB ownership is repointed.
  await prisma.$transaction([
    prisma.attachment.updateMany({
      where: { siteVisitId: visit.id },
      data: { quotationId: quotation.id, siteVisitId: null },
    }),
    prisma.siteVisit.update({
      where: { id: visit.id },
      data: { status: "QUOTED", quotationId: quotation.id, customerId },
    }),
  ]);

  return NextResponse.json(
    { quotationId: quotation.id, quotationNumber },
    { status: 201 }
  );
}
