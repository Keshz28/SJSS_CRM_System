import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/Header";
import { InboxList } from "@/components/inbox/InboxList";

export default async function InboxPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { recipientId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { sender: { select: { name: true } } },
  });

  // Mark everything read when the inbox is opened.
  await prisma.notification.updateMany({
    where: { recipientId: session.user.id, read: false },
    data: { read: true, readAt: new Date() },
  });

  return (
    <div className="flex flex-col flex-1">
      <Header title="Inbox" subtitle="Messages and announcements" />
      <main className="flex-1 p-4 sm:p-6">
        <InboxList
          currentUserRole={session.user.role}
          currentUserId={session.user.id}
          initial={notifications.map((n) => ({
            id: n.id,
            title: n.title,
            body: n.body,
            read: n.read,
            isBroadcast: n.isBroadcast,
            createdAt: n.createdAt.toISOString(),
            senderId: n.senderId,
            sender: n.sender,
          }))}
        />
      </main>
    </div>
  );
}
