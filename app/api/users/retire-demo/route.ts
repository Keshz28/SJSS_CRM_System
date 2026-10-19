import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEMO_EMAILS } from "@/lib/demo-accounts";
import { readJson } from "@/lib/request-body";
import { z } from "zod";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Administrators only" }, { status: 403 });
  const parsed = z.object({ confirm: z.literal(true), preview: z.boolean().default(false) }).safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: "Confirm the account changeover first." }, { status: 400 });
  if (!session.user.adminEmailVerified || DEMO_EMAILS.includes(session.user.email.toLowerCase()))
    return NextResponse.json({ error: "Sign in as a real administrator and complete email verification before retiring demo accounts." }, { status: 409 });
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73192, 1)`;
    const actor = await tx.user.findUnique({ where: { id: session.user.id } });
    if (!actor?.isActive || actor.role !== "ADMIN" || !actor.emailVerifiedAt || DEMO_EMAILS.includes(actor.email.toLowerCase()))
      return NextResponse.json({ error: "An active, verified real administrator is required." }, { status: 409 });
    const where = { email: { in: DEMO_EMAILS }, isActive: true };
    if (parsed.data.preview) return NextResponse.json({ wouldDeactivate: await tx.user.count({ where }) });
    const result = await tx.user.updateMany({ where, data: { isActive: false, sessionVersion: { increment: 1 } } });
    return NextResponse.json({ deactivated: result.count });
  });
}
