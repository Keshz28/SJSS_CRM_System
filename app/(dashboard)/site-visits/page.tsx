import { siteVisitWhere, visitStatus } from "@/lib/site-visit-filters";
import { prisma } from "@/lib/prisma";
import { getCompanyScope } from "@/lib/company-scope";
import { Header } from "@/components/layout/Header";
import { SiteVisitList } from "@/components/site-visits/SiteVisitList";

export default async function SiteVisitsPage({
  searchParams: pendingSearchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; page?: string; view?: string }>;
}) {
  const searchParams = await pendingSearchParams;
  const search = searchParams.search?.trim() || "";
  const status = visitStatus(searchParams.status);
  const view = searchParams.view === "gallery" ? "gallery" : "list";
  const { companyId: company, companies } = await getCompanyScope();
  const where = siteVisitWhere({ company, search, status });
  const pageSize = 20;
  const total = await prisma.siteVisit.count({ where });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const requestedPage = Number(searchParams.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, pages) : 1;
  const visits = await prisma.siteVisit.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      customer: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      company: { select: { id: true, name: true, prefix: true } },
      attachments: {
        orderBy: { uploadedAt: "asc" },
        take: 1,
        select: { id: true, mimetype: true },
      },
      _count: { select: { attachments: true } },
    },
  });

  // Show the company on each visit when combining both businesses.
  const showCompany = !company && companies.length > 1;

  return (
    <div className="flex flex-col flex-1">
      <Header
        title="Site Visits"
        subtitle={`${total} visit${total !== 1 ? "s" : ""} total`}
      />
      <main className="flex-1 p-4 sm:p-6">
        <SiteVisitList
          visits={JSON.parse(JSON.stringify(visits))}
          total={total}
          search={search}
          status={status || ""}
          view={view}
          page={page}
          pageSize={pageSize}
          showCompany={showCompany}
        />
      </main>
    </div>
  );
}
