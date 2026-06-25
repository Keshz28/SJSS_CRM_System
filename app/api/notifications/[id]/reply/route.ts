import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const replySchema = z.object({
  body: z.string().min(1, "Reply can't be empty").max(2000, "Reply is too long"),
});

// Reply to a message in your inbox.
//   • A staff user's reply can ONLY go to admin(s) — never to another user.
//   • An admin replying goes back to the user who messaged them.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // The message being replied to must belong to the signed-in user.
  const original = await prisma.notification.findFirst({
    where: { id: params.id, recipientId: session.user.id },
    include: { sender: { select: { id: true, role: true, isActive: true } } },
  });
  if (!original) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  let recipientIds: string[];

  if (session.user.role === "ADMIN") {
    // Admin replying → back to whoever sent them this message (a staff user).
    if (!original.sender || original.sender.id === session.user.id) {
      return NextResponse.json(
        { error: "There's no one to reply to on this message" },
        { status: 400 }
      );
    }
    recipientIds = [original.sender.id];
  } else {
    // Staff replying → only to admins. Prefer the original sender if they're an
    // active admin, otherwise fan out to every active admin.
    if (original.sender?.role === "ADMIN" && original.sender.isActive) {
      recipientIds = [original.sender.id];
    } else {
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN", isActive: true },
        select: { id: true },
      });
      recipientIds = admins.map((a) => a.id);
    }
  }

  // Never message yourself.
  recipientIds = Array.from(new Set(recipientIds)).filter(
    (id) => id !== session.user.id
  );
  if (recipientIds.length === 0) {
    return NextResponse.json(
      { error: "No active administrator is available to receive your reply" },
      { status: 400 }
    );
  }

  const title = /^re:/i.test(original.title.trim())
    ? original.title
    : `Re: ${original.title}`;

  await prisma.notification.createMany({
    data: recipientIds.map((recipientId) => ({
      recipientId,
      senderId: session.user.id,
      title,
      body: parsed.data.body,
      isBroadcast: false,
    })),
  });

  return NextResponse.json({ sent: recipientIds.length }, { status: 201 });
}
