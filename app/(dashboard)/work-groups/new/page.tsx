import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCompanyScope } from "@/lib/company-scope";
import { Header } from "@/components/layout/Header";
import { WorkGroupForm } from "@/components/work-groups/WorkGroupForm";

export default async function NewWorkGroupPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/work-groups");
  const [{ companies, companyId }, users, projects] = await Promise.all([
    getCompanyScope(), prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ where: { deletedAt: null }, select: { id: true, name: true, companyId: true }, orderBy: { name: "asc" } }),
  ]);
  return <div className="flex flex-col flex-1"><Header title="New work group" subtitle="Choose the team working on a site or area" /><main className="p-4 sm:p-6 space-y-5">
    <Link href="/work-groups" className="dx-btn-ghost min-h-11">← Work groups</Link>
    <WorkGroupForm companies={companies} projects={projects} users={users} currentUserId={session.user.id} defaultCompanyId={companyId} />
  </main></div>;
}
