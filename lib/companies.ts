import { prisma } from "@/lib/prisma";

/** Lightweight company shape used by selectors and lists. */
export interface CompanyOption {
  id: string;
  name: string;
  prefix: string;
}

/** All companies, ordered for display (used in selectors and filters). */
export async function getCompanies(): Promise<CompanyOption[]> {
  return prisma.company.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, prefix: true },
  });
}

/** Full branding details for a company, used on the PDF. */
export async function getCompanyBranding(companyId: string) {
  return prisma.company.findUnique({ where: { id: companyId } });
}
