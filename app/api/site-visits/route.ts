import { positiveInteger } from "@/lib/query-input";
import { readJson } from "@/lib/request-body";
import { siteVisitWhere, visitStatus } from "@/lib/site-visit-filters";
import { getRequestedCompany } from "@/lib/company-scope";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  companyId: z.string().min(1, "Company is required"),
  projectId: z.string().optional().nullable(),
  clientRequestId: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Title is required").max(160),
  customerId: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() || "";
  const status = visitStatus(searchParams.get("status"));
  const company = await getRequestedCompany(req);
  const page = positiveInteger(searchParams.get("page"), 1);
  const limit = positiveInteger(searchParams.get("limit"), 20, 100);
  const skip = (page - 1) * limit;

  const where = siteVisitWhere({ company, search, status });

  const [visits, total] = await Promise.all([
    prisma.siteVisit.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readJson(req);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { companyId, customerId, projectId, clientRequestId, ...rest } =
    parsed.data;
  const existing = clientRequestId
    ? await prisma.siteVisit.findUnique({ where: { clientRequestId }, include: { project: { select: { deletedAt: true } } } })
    : null;
  if (existing?.project?.deletedAt)
    return NextResponse.json({ error: "This project was deleted. Restore it before adding updates." }, { status: 409 });
  if (existing) {
    if (existing.createdById !== session.user.id)
      return NextResponse.json(
        { error: "Request key already used" },
        { status: 409 },
      );
    return NextResponse.json({ id: existing.id });
  }
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company)
    return NextResponse.json(
      { error: "Selected company not found" },
      { status: 400 },
    );
  const project = projectId
    ? await prisma.project.findFirst({ where: { id: projectId, deletedAt: null } })
    : null;
  if (projectId && (!project || project.companyId !== companyId))
    return NextResponse.json(
      { error: "Choose a project belonging to this company." },
      { status: 400 },
    );
  const linkedCustomerId = project?.customerId || customerId || null;
  if (
    linkedCustomerId &&
    !(await prisma.customer.findFirst({
      where: { id: linkedCustomerId, isActive: true, companyId },
    }))
  )
    return NextResponse.json({ error: "Customer not found" }, { status: 400 });
  const data = {
    companyId,
    projectId: projectId || null,
    clientRequestId,
    customerId: linkedCustomerId,
    contactName: rest.contactName || null,
    contactPhone: rest.contactPhone || null,
    location: rest.location || project?.location || null,
    notes: rest.notes || null,
    title: rest.title.trim(),
    createdById: session.user.id,
  };
  try {
    const visit = await prisma.siteVisit.create({ data });
    return NextResponse.json({ id: visit.id }, { status: 201 });
  } catch (error) {
    const duplicate = clientRequestId
      ? await prisma.siteVisit.findUnique({ where: { clientRequestId }, include: { project: { select: { deletedAt: true } } } })
      : null;
    if (duplicate?.createdById === session.user.id)
      return NextResponse.json({ id: duplicate.id });
    throw error;
  }
}
