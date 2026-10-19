import { activeVisitWhere } from "@/lib/project-visibility";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { SiteVisitDetail } from "@/components/site-visits/SiteVisitDetail";
import { siteVisitReturnTo } from "@/lib/site-visit-navigation";
export default async function SiteVisitPage({
  params: pendingParams,
  searchParams: pendingSearchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const params = await pendingParams;
  const { returnTo } = await pendingSearchParams;
  const visit = await prisma.siteVisit.findFirst({
    where: { id: params.id, ...activeVisitWhere },
    include: {
      customer: { select: { id: true, name: true } },
      company: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      attachments: {
        orderBy: { uploadedAt: "asc" },
        include: { uploadedBy: { select: { name: true } } },
      },
      quotation: { select: { id: true, quotationNumber: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (!visit) notFound();
  return (
    <div className="flex flex-col flex-1">
      <Header
        title={visit.title}
        subtitle={visit.project?.name || "Site visit"}
      />
      <main className="flex-1 p-4 sm:p-6">
        <SiteVisitDetail visit={JSON.parse(JSON.stringify(visit))} returnTo={siteVisitReturnTo(returnTo)} />
      </main>
    </div>
  );
}
