import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCompanies } from "@/lib/companies";
import { Header } from "@/components/layout/Header";
import { ProjectWorkspace } from "@/components/projects/ProjectWorkspace";
export default async function ProjectPage({
  params: pendingParams,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = await pendingParams;
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const project = await prisma.project.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      preferences: { where: { userId: session.user.id }, select: { isPinned: true, isStarred: true } },
      company: { select: { name: true } },
      customer: { select: { name: true } },
      siteVisits: {
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          createdBy: { select: { name: true } },
          _count: { select: { attachments: true } },
        },
      },
      quotations: {
        orderBy: { createdAt: "desc" },
        select: { id: true, quotationNumber: true, status: true },
      },
    },
  });
  if (!project) notFound();
  const [media, companies, customers] = await Promise.all([
    prisma.attachment.findMany({
      where: { siteVisit: { projectId: project.id } },
      orderBy: { uploadedAt: "desc" },
      take: 200,
      include: { uploadedBy: { select: { name: true } } },
    }),
    getCompanies(),
    prisma.customer.findMany({
      where: { isActive: true },
      select: { id: true, name: true, companyId: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <div className="flex flex-col flex-1">
      <Header title={project.name} subtitle="Project workspace" />
      <main className="p-4 sm:p-6">
        <ProjectWorkspace
          project={JSON.parse(JSON.stringify(project))}
          isPinned={project.preferences[0]?.isPinned || false}
          isStarred={project.preferences[0]?.isStarred || false}
          media={JSON.parse(JSON.stringify(media))}
          canEdit={
            session.user.role === "ADMIN" ||
            project.createdById === session.user.id
          }
          companies={companies}
          customers={customers}
        />
      </main>
    </div>
  );
}
