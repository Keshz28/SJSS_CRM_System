import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Mark a single notification as read (only the recipient can).
export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await prisma.notification.updateMany({
    where: { id: params.id, recipientId: session.user.id },
    data: { read: true, readAt: new Date() },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

// Delete a notification from your own inbox.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await prisma.notification.deleteMany({
    where: { id: params.id, recipientId: session.user.id },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
