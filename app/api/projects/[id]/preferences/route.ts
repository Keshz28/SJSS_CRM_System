import { readJson } from "@/lib/request-body";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({ isPinned: z.boolean().optional(), isStarred: z.boolean().optional() })
  .strict().refine((v) => v.isPinned !== undefined || v.isStarred !== undefined, "Choose a pin or star setting.");
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  if (!(await prisma.project.findFirst({ where: { id, deletedAt: null } })))
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const preference = await prisma.projectPreference.upsert({
    where: { userId_projectId: { userId: session.user.id, projectId: id } },
    create: { userId: session.user.id, projectId: id, ...parsed.data }, update: parsed.data,
    select: { isPinned: true, isStarred: true },
  });
  return NextResponse.json(preference);
}
