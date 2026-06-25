import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Get the signed-in user's notifications + unread count.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "30"), 100);

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { sender: { select: { name: true } } },
    }),
    prisma.notification.count({
      where: { recipientId: session.user.id, read: false },
    }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

const sendSchema = z.object({
  title: z.string().min(1, "Title is required").max(120, "Title is too long"),
  body: z.string().min(1, "Message is required").max(2000, "Message is too long"),
  // "all" = broadcast to every active user; otherwise a specific user id.
  target: z.string().min(1, "Pick a recipient"),
});

// Send a message: broadcast to everyone, or privately to one user (admin only).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Administrators only" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, body: message, target } = parsed.data;

  if (target === "all") {
    // One notification per active user, excluding the sender.
    const recipients = await prisma.user.findMany({
      where: { isActive: true, id: { not: session.user.id } },
      select: { id: true },
    });
    if (recipients.length === 0) {
      return NextResponse.json({ error: "There are no other active users to message" }, { status: 400 });
    }
    await prisma.notification.createMany({
      data: recipients.map((r) => ({
        recipientId: r.id,
        senderId: session.user.id,
        title,
        body: message,
        isBroadcast: true,
      })),
    });
    return NextResponse.json({ sent: recipients.length, broadcast: true }, { status: 201 });
  }

  const recipient = await prisma.user.findUnique({ where: { id: target } });
  if (!recipient) {
    return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
  }

  await prisma.notification.create({
    data: {
      recipientId: recipient.id,
      senderId: session.user.id,
      title,
      body: message,
      isBroadcast: false,
    },
  });

  return NextResponse.json({ sent: 1, broadcast: false }, { status: 201 });
}
