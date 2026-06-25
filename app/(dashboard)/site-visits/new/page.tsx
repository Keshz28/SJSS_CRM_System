import { prisma } from "@/lib/prisma";
import { getCompanies } from "@/lib/companies";
import { Header } from "@/components/layout/Header";
import { SiteVisitCapture } from "@/components/site-visits/SiteVisitCapture";

export default async function NewSiteVisitPage() {
  const [customers, companies] = await Promise.all([
    prisma.customer.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getCompanies(),
  ]);

  return (
    <div className="flex flex-col flex-1">
      <Header title="New Site Visit" subtitle="Capture photos and notes from the site" />
      <main className="flex-1 p-6">
        <SiteVisitCapture customers={customers} companies={companies} />
      </main>
    </div>
  );
}
