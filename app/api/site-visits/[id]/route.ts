import { readJson } from "@/lib/request-body";
import { activeVisitWhere } from "@/lib/project-visibility";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { removeUnreferencedFile } from "@/lib/file-storage";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  customerId: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(
  req: NextRequest,
  { params: pendingParams }: { params: Promise<{ id: string }> },
) {
  const params = await pendingParams;
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const visit = await prisma.siteVisit.findFirst({
    where: { id: params.id, ...activeVisitWhere },
    include: {
      customer: true,
      company: { select: { id: true, name: true, prefix: true } },
      attachments: { orderBy: { uploadedAt: "asc" } },
      quotation: { select: { id: true, quotationNumber: true } },
      createdBy: { select: { name: true } },
    },
  });

  if (!visit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(visit);
}

export async function PUT(
  req: NextRequest,
  { params: pendingParams }: { params: Promise<{ id: string }> },
) {
  const params = await pendingParams;
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readJson(req);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await prisma.siteVisit.findFirst({ where: { id: params.id, ...activeVisitWhere } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.createdById !== session.user.id && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Only the creator or an administrator can edit this site update." }, { status: 403 });
  if (parsed.data.customerId && !(await prisma.customer.findFirst({ where: { id: parsed.data.customerId, companyId: existing.companyId, isActive: true } })))
    return NextResponse.json({ error: "Choose a customer belonging to this company." }, { status: 400 });
  const data = parsed.data;
  const visit = await prisma.siteVisit.update({
    where: { id: params.id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.customerId !== undefined && {
        customerId: data.customerId || null,
      }),
      ...(data.contactName !== undefined && {
        contactName: data.contactName || null,
      }),
      ...(data.contactPhone !== undefined && {
        contactPhone: data.contactPhone || null,
      }),
      ...(data.location !== undefined && { location: data.location || null }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
    },
  });

  return NextResponse.json(visit);
}

export async function DELETE(
  req: NextRequest,
  { params: pendingParams }: { params: Promise<{ id: string }> },
) {
  const params = await pendingParams;
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Attachments cascade-delete via the schema relation.
  const record = await prisma.siteVisit.findFirst({
    where: { id: params.id, ...activeVisitWhere },
    include: { attachments: true },
  });
  if (!record)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (record.createdById !== session.user.id && session.user.role !== "ADMIN")
    return NextResponse.json(
      { error: "Only the creator or an administrator can delete this record." },
      { status: 403 },
    );
  await prisma.siteVisit.delete({ where: { id: params.id } });
  for (const attachment of record.attachments)
    await removeUnreferencedFile(attachment.filepath);
  return NextResponse.json({ success: true });
}
