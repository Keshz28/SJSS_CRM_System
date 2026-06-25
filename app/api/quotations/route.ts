import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateQuotationNumber } from "@/lib/quotation-number";
import { z } from "zod";

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  order: z.number().default(0),
});

const quotationSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  companyId: z.string().min(1, "Company is required"),
  subject: z.string().optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  validUntil: z.string().optional(),
  items: z.array(itemSchema).min(1, "At least one item is required"),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "";
  const company = searchParams.get("company") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (company) where.companyId = company;
  if (search) {
    where.OR = [
      { quotationNumber: { contains: search, mode: "insensitive" } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { subject: { contains: search, mode: "insensitive" } },
    ];
  }

  const [quotations, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        customer: true,
        company: { select: { id: true, name: true, prefix: true } },
        _count: { select: { items: true, attachments: true } },
      },
    }),
    prisma.quotation.count({ where }),
  ]);

  return NextResponse.json({ quotations, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = quotationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { items, validUntil, companyId, ...rest } = parsed.data;
  const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const quotationNumber = await generateQuotationNumber(companyId);

  const quotation = await prisma.quotation.create({
    data: {
      ...rest,
      companyId,
      quotationNumber,
      totalAmount,
      validUntil: validUntil ? new Date(validUntil) : null,
      createdById: session.user.id,
      items: {
        create: items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice,
          order: item.order,
        })),
      },
    },
    include: { customer: true, items: true },
  });

  return NextResponse.json(quotation, { status: 201 });
}
