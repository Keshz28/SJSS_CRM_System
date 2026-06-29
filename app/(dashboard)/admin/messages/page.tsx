import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/Header";
import { MessageComposer } from "@/components/admin/MessageComposer";

export default async function AdminMessagesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const recipients = await prisma.user.findMany({
    where: { isActive: true, id: { not: session.user.id } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  return (
    <div className="flex flex-col flex-1">
      <Header title="Send Message" subtitle="Broadcast to everyone or send a private notification" />
      <main className="flex-1 p-4 sm:p-6">
        <MessageComposer recipients={recipients} />
      </main>
    </div>
  );
}
