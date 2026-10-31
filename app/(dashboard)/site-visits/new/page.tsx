import { activeVisitWhere } from "@/lib/project-visibility";
import { prisma } from "@/lib/prisma";
import { getCompanyScope } from "@/lib/company-scope";
import { Header } from "@/components/layout/Header";
import { SiteVisitCapture } from "@/components/site-visits/SiteVisitCapture";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { siteVisitReturnTo } from "@/lib/site-visit-navigation";
export default async function NewSiteVisitPage({
  searchParams: pendingSearchParams,
}: {
  searchParams: Promise<{ projectId?: string; visitId?: string; returnTo?: string }>;
}) {
  const searchParams = await pendingSearchParams;
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const [customers, { companies, companyId }, projects] = await Promise.all([
    prisma.customer.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, companyId: true },
    }),
    getCompanyScope(),
    prisma.project.findMany({
      where: { deletedAt: null },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        companyId: true,
        customerId: true,
        location: true,
      },
    }),
  ]);
  const existingVisit = searchParams.visitId
    ? await prisma.siteVisit.findFirst({ where: { id: searchParams.visitId, ...activeVisitWhere } })
    : null;
  if (existingVisit && existingVisit.createdById !== session.user.id && session.user.role !== "ADMIN") redirect(`/site-visits/${existingVisit.id}`);
  if ((searchParams.projectId && !projects.some((p) => p.id === searchParams.projectId)) || (searchParams.visitId && !existingVisit)) redirect("/projects");
  return (
    <div className="flex flex-col flex-1">
      <Header
        title="Capture a site update"
        subtitle="Project photos, descriptions and voice notes"
      />
      <main className="flex-1 p-4 sm:p-6">
        <SiteVisitCapture
          key={`${session.user.id}:${searchParams.visitId || searchParams.projectId || `general:${companyId}`}`}
          existingVisit={existingVisit || undefined}
          returnTo={searchParams.returnTo ? siteVisitReturnTo(searchParams.returnTo) : undefined}
          customers={customers}
          companies={companies}
          projects={projects}
          ownerId={session.user.id}
          defaultCompanyId={companyId}
          defaultProjectId={searchParams.projectId}
        />
      </main>
    </div>
  );
}
