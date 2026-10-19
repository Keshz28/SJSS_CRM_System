import { readJson } from "@/lib/request-body";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectSchema } from "@/lib/project-schema";
export async function PATCH(
  req: NextRequest,
  { params: pendingParams }: { params: Promise<{ id: string }> },
) {
  const params = await pendingParams;
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const project = await prisma.project.findFirst({ where: { id: params.id, deletedAt: null } });
  if (!project)
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (project.createdById !== session.user.id && session.user.role !== "ADMIN")
    return NextResponse.json(
      {
        error:
          "Only the project creator or an administrator can edit project details.",
      },
      { status: 403 },
    );
  const parsed = projectSchema
    .omit({ companyId: true, newCustomer: true })
    .partial()
    .safeParse(await readJson(req));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  if (
    parsed.data.customerId &&
    !(await prisma.customer.findFirst({
      where: { id: parsed.data.customerId, isActive: true, companyId: project.companyId },
    }))
  )
    return NextResponse.json({ error: "Customer not found" }, { status: 400 });
  return NextResponse.json(
    await prisma.project.update({
      where: { id: params.id },
      data: {
        ...parsed.data,
        ...(parsed.data.customerId !== undefined && {
          customerId: parsed.data.customerId || null,
        }),
      },
    }),
  );
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (project.createdById !== session.user.id && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Only the project creator or an administrator can delete this project." }, { status: 403 });
  await prisma.project.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
  return NextResponse.json({ deleted: true });
}
