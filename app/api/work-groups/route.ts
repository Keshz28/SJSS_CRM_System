import { readJson } from "@/lib/request-body";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRequestedCompany } from "@/lib/company-scope";
import { listWorkGroups, newWorkGroupSchema, validateWorkGroupMembers, WorkGroupError, workGroupFailure } from "@/lib/work-groups";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = await getRequestedCompany(req);
  return NextResponse.json(await listWorkGroups(session.user.id, companyId, req.nextUrl.searchParams.get("search")?.trim() || "", Number(req.nextUrl.searchParams.get("page"))), { headers: { "Cache-Control": "private, no-store" } });
}
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Only administrators can create work groups." }, { status: 403 });
  try {
    const data = newWorkGroupSchema.parse(await readJson(req).catch(() => null));
    const selected = await getRequestedCompany(req);
    if (selected && selected !== data.companyId) throw new WorkGroupError("Choose the selected company for this group.");
    const group = await prisma.$transaction(async (tx) => {
      if (!await tx.company.findUnique({ where: { id: data.companyId }, select: { id: true } })) throw new WorkGroupError("Company not found.");
      if (data.projectId && !await tx.project.findFirst({ where: { id: data.projectId, companyId: data.companyId, deletedAt: null }, select: { id: true } })) throw new WorkGroupError("Choose an active project from this company.");
      const members = await validateWorkGroupMembers(tx, [...data.memberIds, session.user.id]);
      if (members.length < 2 || members.length > 100) throw new WorkGroupError("Choose between 1 and 99 other members.");
      return tx.workGroup.create({ data: {
        name: data.name, description: data.description, companyId: data.companyId, projectId: data.projectId || null,
        createdById: session.user.id, members: { create: members.map((userId) => ({ userId })) },
      }, select: { id: true } });
    });
    return NextResponse.json(group, { status: 201 });
  } catch (error) { const failure = workGroupFailure(error); return NextResponse.json({ error: failure.error }, { status: failure.status }); }
}
