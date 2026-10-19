import { readJson } from "@/lib/request-body";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { removeUnreferencedFile } from "@/lib/file-storage";
import { quotationUpdateSchema, quotationTotal, lineTotal } from "@/lib/quotation-schema";

export async function GET(
  req: NextRequest,
  { params: pendingParams }: { params: Promise<{ id: string }> },
) {
  const params = await pendingParams;
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quotation = await prisma.quotation.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      items: { orderBy: { order: "asc" } },
      attachments: { orderBy: { uploadedAt: "desc" } },
      createdBy: { select: { name: true, email: true } },
    },
  });

  if (!quotation)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(quotation);
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
  const parsed = quotationUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { items, validUntil, ...rest } = parsed.data;
  const existing = await prisma.quotation.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.createdById !== session.user.id && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Only the creator or an administrator can edit this quotation." }, { status: 403 });
  if (rest.customerId && !(await prisma.customer.findFirst({
    where: { id: rest.customerId, companyId: existing.companyId, isActive: true },
  })))
    return NextResponse.json({ error: "Choose a customer belonging to this company." }, { status: 400 });

  const totalAmount = items
    ? quotationTotal(items)
    : undefined;

  const quotation = await prisma.quotation.update({
    where: { id: params.id },
    data: {
      ...rest,
      ...(totalAmount !== undefined && { totalAmount }),
      ...(validUntil !== undefined && {
        validUntil: validUntil ? new Date(validUntil) : null,
      }),
      ...(items && {
        items: {
          deleteMany: {},
          create: items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: lineTotal(item),
            order: item.order,
          })),
        },
      }),
    },
    include: { customer: true, items: true, attachments: true },
  });

  return NextResponse.json(quotation);
}

export async function DELETE(
  req: NextRequest,
  { params: pendingParams }: { params: Promise<{ id: string }> },
) {
  const params = await pendingParams;
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const record = await prisma.quotation.findUnique({
    where: { id: params.id },
    include: { attachments: true },
  });
  if (!record)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (record.createdById !== session.user.id && session.user.role !== "ADMIN")
    return NextResponse.json(
      { error: "Only the creator or an administrator can delete this record." },
      { status: 403 },
    );
  await prisma.quotation.delete({ where: { id: params.id } });
  for (const attachment of record.attachments)
    await removeUnreferencedFile(attachment.filepath);
  return NextResponse.json({ success: true });
}
