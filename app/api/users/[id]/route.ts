import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "USER"]).optional(),
  isActive: z.boolean().optional(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .optional()
    .or(z.literal("")),
});

// Edit a user: rename, change role, activate/deactivate, or reset password (admin only).
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Administrators only" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Guard: don't let an admin demote or deactivate themselves (avoids self-lockout).
  const editingSelf = target.id === session.user.id;
  if (editingSelf && (parsed.data.role === "USER" || parsed.data.isActive === false)) {
    return NextResponse.json(
      { error: "You can't change your own role or deactivate your own account" },
      { status: 400 }
    );
  }

  // Guard: never remove the last active admin.
  if (
    target.role === "ADMIN" &&
    (parsed.data.role === "USER" || parsed.data.isActive === false)
  ) {
    const activeAdmins = await prisma.user.count({
      where: { role: "ADMIN", isActive: true },
    });
    if (activeAdmins <= 1) {
      return NextResponse.json(
        { error: "This is the only active administrator — promote another admin first" },
        { status: 400 }
      );
    }
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.role !== undefined) data.role = parsed.data.role;
  if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
  if (parsed.data.password) {
    data.passwordHash = await bcrypt.hash(parsed.data.password, 12);
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });

  return NextResponse.json(user);
}

// Delete a user account (admin only).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Administrators only" }, { status: 403 });
  }

  if (params.id === session.user.id) {
    return NextResponse.json({ error: "You can't delete your own account" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    include: { _count: { select: { quotations: true, siteVisits: true } } },
  });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Users who own records can't be hard-deleted (would orphan quotations/site visits).
  // Deactivate them instead so their history stays intact.
  if (target._count.quotations > 0 || target._count.siteVisits > 0) {
    await prisma.user.update({
      where: { id: params.id },
      data: { isActive: false },
    });
    return NextResponse.json({
      deactivated: true,
      message:
        "This user has created quotations or site visits, so the account was deactivated (not deleted) to preserve that history.",
    });
  }

  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ deleted: true });
}
