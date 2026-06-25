import { prisma } from "@/lib/prisma";
import { getCompanies } from "@/lib/companies";
import { Header } from "@/components/layout/Header";
import { SiteVisitList } from "@/components/site-visits/SiteVisitList";

export default async function SiteVisitsPage({
  searchParams,
}: {
  searchParams: { search?: string; company?: string };
}) {
  const search = searchParams.search ?? "";
  const company = searchParams.company ?? "";

  const where: Record<string, unknown> = {};
  if (company) where.companyId = company;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { location: { contains: search, mode: "insensitive" } },
      { contactName: { contains: search, mode: "insensitive" } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [visits, total, companies] = await Promise.all([
    prisma.siteVisit.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 60,
      include: {
        customer: { select: { id: true, name: true } },
        company: { select: { id: true, name: true, prefix: true } },
        attachments: { orderBy: { uploadedAt: "asc" }, take: 1, select: { id: true, filepath: true, mimetype: true } },
        _count: { select: { attachments: true } },
      },
    }),
    prisma.siteVisit.count({ where }),
    getCompanies(),
  ]);

  return (
    <div className="flex flex-col flex-1">
      <Header title="Site Visits" subtitle={`${total} visit${total !== 1 ? "s" : ""} total`} />
      <main className="flex-1 p-6">
        <SiteVisitList
          visits={JSON.parse(JSON.stringify(visits))}
          total={total}
          search={search}
          company={company}
          companies={companies}
        />
      </main>
    </div>
  );
}
