import { readJson } from "@/lib/request-body";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRequestedCompany } from "@/lib/company-scope";
import { getWorkGroup, lockWorkGroup, validateWorkGroupMembers, workGroupDetailsSchema, WorkGroupError, workGroupFailure } from "@/lib/work-groups";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Only administrators can manage work groups." }, { status: 403 });
  try {
    const { id } = await params;
    const data = workGroupDetailsSchema.parse(await readJson(req).catch(() => null));
    const companyId = await getRequestedCompany(req);
    await prisma.$transaction(async (tx) => {
      await lockWorkGroup(tx, id);
      await getWorkGroup(id, session.user.id, companyId, tx);
      if (!data.memberIds.includes(session.user.id)) throw new WorkGroupError("Keep yourself in the group to manage it.");
      const members = await validateWorkGroupMembers(tx, data.memberIds);
      await tx.workGroupMember.deleteMany({ where: { groupId: id, userId: { notIn: members } } });
      await tx.workGroupMember.createMany({ data: members.map((userId) => ({ groupId: id, userId })), skipDuplicates: true });
      await tx.workGroup.update({ where: { id }, data: { name: data.name, description: data.description } });
    });
    return NextResponse.json({ updated: true });
  } catch (error) { const failure = workGroupFailure(error); return NextResponse.json({ error: failure.error }, { status: failure.status }); }
}
