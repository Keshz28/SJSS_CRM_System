import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (project.createdById !== session.user.id && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Only the project creator or an administrator can restore this project." }, { status: 403 });
  await prisma.project.updateMany({ where: { id, deletedAt: { not: null } }, data: { deletedAt: null } });
  return NextResponse.json({ restored: true });
}
