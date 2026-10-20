import { readJson } from "@/lib/request-body";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRequestedCompany } from "@/lib/company-scope";
import { getWorkGroup, lockWorkGroup, workGroupMessages, workGroupMessageSchema, WorkGroupError, workGroupFailure } from "@/lib/work-groups";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    await getWorkGroup(id, session.user.id, await getRequestedCompany(req));
    return NextResponse.json(await workGroupMessages(id, req.nextUrl.searchParams), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { const failure = workGroupFailure(error); return NextResponse.json({ error: failure.error }, { status: failure.status }); }
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const data = workGroupMessageSchema.parse(await readJson(req).catch(() => null));
    if (data.isAnnouncement && session.user.role !== "ADMIN") throw new WorkGroupError("Only administrators can post official announcements.", 403);
    const companyId = await getRequestedCompany(req);
    const message = await prisma.$transaction(async (tx) => {
      await lockWorkGroup(tx, id);
      await getWorkGroup(id, session.user.id, companyId, tx);
      const existing = await tx.workGroupMessage.findUnique({ where: { clientRequestId: data.clientRequestId } });
      if (existing) {
        if (existing.groupId !== id || existing.authorId !== session.user.id || existing.body !== data.body || existing.isAnnouncement !== data.isAnnouncement)
          throw new WorkGroupError("This send key has already been used for another message.", 409);
        return existing;
      }
      const created = await tx.workGroupMessage.create({ data: { ...data, groupId: id, authorId: session.user.id, authorName: session.user.name || "Team member" } });
      await tx.workGroup.update({ where: { id }, data: { updatedAt: new Date() } });
      return created;
    });
    return NextResponse.json(message, { status: 201 });
  } catch (error) { const failure = workGroupFailure(error); return NextResponse.json({ error: failure.error }, { status: failure.status }); }
}
