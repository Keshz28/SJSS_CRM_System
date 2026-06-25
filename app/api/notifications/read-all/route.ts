import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Mark all of the signed-in user's notifications as read.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.notification.updateMany({
    where: { recipientId: session.user.id, read: false },
    data: { read: true, readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
