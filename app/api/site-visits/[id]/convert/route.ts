import { activeVisitWhere } from "@/lib/project-visibility";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateQuotationNumber } from "@/lib/quotation-number";
export async function POST(
  _req: Request,
  { params: pendingParams }: { params: Promise<{ id: string }> },
) {
  const params = await pendingParams;
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const owner = await prisma.siteVisit.findFirst({ where: { id: params.id, ...activeVisitWhere }, select: { createdById: true } });
  if (!owner) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (owner.createdById !== session.user.id && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Only the creator or an administrator can convert this site update." }, { status: 403 });
  const result = await prisma.$transaction(async (tx) => {
    // Serialize conversions for a visit, including retries and simultaneous taps.
    await tx.$queryRaw`SELECT id FROM site_visits WHERE id = ${params.id} FOR UPDATE`;
    const visit = await tx.siteVisit.findFirst({
      where: { id: params.id, ...activeVisitWhere },
      include: { attachments: true, quotation: true, project: true },
    });
    if (!visit) return null;
    if (visit.quotation) return visit.quotation;
    const customer = visit.customerId
      ? null
      : await tx.customer.create({
          data: {
            name:
              visit.contactName?.trim() || visit.project?.name || visit.title,
            companyId: visit.companyId,
            phone: visit.contactPhone,
            address: visit.location,
          },
        });
    const customerId = visit.customerId || customer!.id;
    const quotation = await tx.quotation.create({
      data: {
        quotationNumber: await generateQuotationNumber(visit.companyId, tx),
        customerId,
        companyId: visit.companyId,
        projectId: visit.projectId,
        subject: visit.title,
        notes: visit.notes,
        totalAmount: 0,
        status: "DRAFT",
        createdById: session.user.id,
        // Copy attachment references; keep the original visit and its media intact.
        attachments: {
          create: visit.attachments.map((a) => ({
            filename: a.filename,
            filepath: a.filepath,
            filesize: a.filesize,
            mimetype: a.mimetype,
            caption: a.caption,
            uploadedById: a.uploadedById,
          })),
        },
      },
    });
    await tx.siteVisit.update({
      where: { id: visit.id },
      data: { status: "QUOTED", quotationId: quotation.id, customerId },
    });
    if (visit.projectId) {
      await tx.project.updateMany({
        where: { id: visit.projectId, customerId: null },
        data: { customerId },
      });
    }
    return quotation;
  });
  if (!result)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(
    { quotationId: result.id, quotationNumber: result.quotationNumber },
    { status: 201 },
  );
}
