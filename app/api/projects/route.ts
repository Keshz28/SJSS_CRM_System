import { readJson } from "@/lib/request-body";
import { listProjects, projectView } from "@/lib/project-list";
import { getRequestedCompany } from "@/lib/company-scope";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectSchema } from "@/lib/project-schema";
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const search = req.nextUrl.searchParams.get("search")?.trim() || "";
  const companyId = await getRequestedCompany(req);
  const { projects } = await listProjects({
    userId: session.user.id, companyId, search,
    status: req.nextUrl.searchParams.get("status") || undefined,
    view: projectView(req.nextUrl.searchParams.get("view")), limit: 100,
  });
  return NextResponse.json(projects);
}
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = projectSchema.safeParse(await readJson(req));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  const { customerId, newCustomer, ...data } = parsed.data;
  if (customerId && newCustomer)
    return NextResponse.json({ error: "Choose an existing customer or add a new one." }, { status: 400 });
  if (!(await prisma.company.findUnique({ where: { id: data.companyId } })))
    return NextResponse.json({ error: "Company not found" }, { status: 400 });
  if (
    customerId &&
    !(await prisma.customer.findFirst({
      where: { id: customerId, isActive: true, companyId: data.companyId },
    }))
  )
    return NextResponse.json({ error: "Customer not found" }, { status: 400 });
  return NextResponse.json(
    await prisma.$transaction(async (tx) => {
      const customer = newCustomer
        ? await tx.customer.create({
            data: { ...newCustomer, email: newCustomer.email || null, companyId: data.companyId },
          })
        : null;
      return tx.project.create({
        data: {
          ...data,
          customerId: customer?.id || customerId || null,
          createdById: session.user.id,
        },
      });
    }),
    { status: 201 },
  );
}
