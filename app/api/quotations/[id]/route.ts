import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  order: z.number().default(0),
});

const updateSchema = z.object({
  customerId: z.string().optional(),
  subject: z.string().optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  validUntil: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED"]).optional(),
  items: z.array(itemSchema).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quotation = await prisma.quotation.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      items: { orderBy: { order: "asc" } },
      attachments: { orderBy: { uploadedAt: "desc" } },
      createdBy: { select: { name: true, email: true } },
    },
  });

  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(quotation);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { items, validUntil, ...rest } = parsed.data;

  const totalAmount = items
    ? items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)
    : undefined;

  const quotation = await prisma.quotation.update({
    where: { id: params.id },
    data: {
      ...rest,
      ...(totalAmount !== undefined && { totalAmount }),
      ...(validUntil !== undefined && { validUntil: validUntil ? new Date(validUntil) : null }),
      ...(items && {
        items: {
          deleteMany: {},
          create: items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
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
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.quotation.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
