import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { SiteVisitDetail } from "@/components/site-visits/SiteVisitDetail";

export default async function SiteVisitDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const visit = await prisma.siteVisit.findUnique({
    where: { id: params.id },
    include: {
      customer: { select: { id: true, name: true } },
      company: { select: { id: true, name: true, prefix: true } },
      attachments: { orderBy: { uploadedAt: "asc" } },
      quotation: { select: { id: true, quotationNumber: true } },
      createdBy: { select: { name: true } },
    },
  });

  if (!visit) notFound();

  return (
    <div className="flex flex-col flex-1">
      <Header title={visit.title} subtitle={visit.location ?? "Site visit"} />
      <main className="flex-1 p-6">
        <SiteVisitDetail visit={JSON.parse(JSON.stringify(visit))} />
      </main>
    </div>
  );
}
