import { readJson } from "@/lib/request-body";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { customerSchema } from "@/lib/customer-schema";
import { getCompanyScope } from "@/lib/company-scope";

export async function GET(
  req: NextRequest,
  { params: pendingParams }: { params: Promise<{ id: string }> },
) {
  const params = await pendingParams;
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId } = await getCompanyScope();
  const customer = await prisma.customer.findFirst({
    where: { id: params.id, ...(companyId && { companyId }) },
    include: {
      quotations: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { customer: true },
      },
    },
  });

  if (!customer)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(customer);
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
  const parsed = customerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await prisma.customer.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  if (existing.companyId && existing.companyId !== parsed.data.companyId)
    return NextResponse.json({ error: "A customer belongs to one company. Create a separate customer record for the other company." }, { status: 409 });
  if (!(await prisma.company.findUnique({ where: { id: parsed.data.companyId } })))
    return NextResponse.json({ error: "Company not found" }, { status: 400 });

  const customer = await prisma.customer.update({
    where: { id: params.id },
    data: {
      ...parsed.data,
      email: parsed.data.email || null,
    },
  });

  return NextResponse.json(customer);
}

export async function DELETE(
  req: NextRequest,
  { params: pendingParams }: { params: Promise<{ id: string }> },
) {
  const params = await pendingParams;
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.customer.update({
    where: { id: params.id },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
