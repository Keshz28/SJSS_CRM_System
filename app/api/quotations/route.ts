import { positiveInteger, quotationStatus } from "@/lib/query-input";
import { readJson } from "@/lib/request-body";
import { getRequestedCompany } from "@/lib/company-scope";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateQuotationNumber } from "@/lib/quotation-number";
import { quotationCreateSchema, quotationTotal, lineTotal } from "@/lib/quotation-schema";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const status = quotationStatus(searchParams.get("status"));
  const company = await getRequestedCompany(req);
  const page = positiveInteger(searchParams.get("page"), 1);
  const limit = positiveInteger(searchParams.get("limit"), 20, 100);
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

  const body = await readJson(req);
  const parsed = quotationCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { items, validUntil, companyId, ...rest } = parsed.data;
  if (!(await prisma.company.findUnique({ where: { id: companyId } })))
    return NextResponse.json({ error: "Company not found" }, { status: 400 });
  if (!(await prisma.customer.findFirst({ where: { id: rest.customerId, companyId, isActive: true } })))
    return NextResponse.json({ error: "Choose a customer belonging to this company." }, { status: 400 });
  const totalAmount = quotationTotal(items);
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
          total: lineTotal(item),
          order: item.order,
        })),
      },
    },
    include: { customer: true, items: true },
  });

  return NextResponse.json(quotation, { status: 201 });
}
