import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCompanyScope } from "@/lib/company-scope";
import { getWorkGroup, WorkGroupError } from "@/lib/work-groups";
import { Header } from "@/components/layout/Header";
import { WorkGroupChat } from "@/components/work-groups/WorkGroupChat";
import { WorkGroupForm } from "@/components/work-groups/WorkGroupForm";

export default async function WorkGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const { id } = await params;
  const { companyId } = await getCompanyScope();
  const group = await getWorkGroup(id, session.user.id, companyId).catch((error) => {
    if (error instanceof WorkGroupError && error.status === 404) redirect("/work-groups");
    throw error;
  });
  const isAdmin = session.user.role === "ADMIN";
  const users = isAdmin ? await prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [];
  return <div className="flex flex-col flex-1"><Header title={group.name} subtitle={`${group.company.name} · ${group.members.length} members`} /><main className="p-4 sm:p-6 space-y-4 min-w-0">
    <div className="flex flex-wrap gap-2"><Link href="/work-groups" prefetch={false} className="dx-btn-ghost min-h-11 text-sm">← Work groups</Link>{group.project && !group.project.deletedAt && <Link href={`/projects/${group.project.id}`} className="dx-btn-ghost min-h-11 text-sm">Open project: {group.project.name}</Link>}</div>
    {group.description && <p className="text-sm text-dx-ink-muted whitespace-pre-wrap break-words">{group.description}</p>}
    <details className="dx-card p-3 max-w-4xl"><summary className="text-sm text-dx-ink cursor-pointer min-h-11 flex items-center">Members{isAdmin ? " and group settings" : ""}</summary>
      <p className="text-xs text-dx-ink-muted mb-3 break-words">{group.members.map((member) => `${member.user.name}${member.user.isActive ? "" : " (inactive)"}`).join(", ")}</p>
      {isAdmin && <WorkGroupForm key={group.updatedAt.toISOString()} companies={[group.company]} projects={[]} users={users} currentUserId={session.user.id} group={{ id, name: group.name, description: group.description, companyId: group.companyId, projectId: group.projectId, memberIds: group.members.map((m) => m.userId) }} />}
    </details>
    <WorkGroupChat key={id} id={id} currentUserId={session.user.id} isAdmin={isAdmin} />
  </main></div>;
}
