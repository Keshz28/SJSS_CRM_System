import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  companyId: z.string().min(1, "Company is required"),
  title: z.string().min(1, "Title is required"),
  customerId: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
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
      { title: { contains: search, mode: "insensitive" } },
      { location: { contains: search, mode: "insensitive" } },
      { contactName: { contains: search, mode: "insensitive" } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [visits, total] = await Promise.all([
    prisma.siteVisit.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        customer: { select: { id: true, name: true } },
        company: { select: { id: true, name: true, prefix: true } },
        attachments: { orderBy: { uploadedAt: "asc" }, take: 1 },
        _count: { select: { attachments: true } },
      },
    }),
    prisma.siteVisit.count({ where }),
  ]);

  return NextResponse.json({ visits, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { companyId, customerId, ...rest } = parsed.data;

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    return NextResponse.json({ error: "Selected company not found" }, { status: 400 });
  }

  const visit = await prisma.siteVisit.create({
    data: {
      companyId,
      customerId: customerId || null,
      contactName: rest.contactName || null,
      contactPhone: rest.contactPhone || null,
      location: rest.location || null,
      notes: rest.notes || null,
      title: rest.title,
      createdById: session.user.id,
    },
  });

  return NextResponse.json({ id: visit.id }, { status: 201 });
}
