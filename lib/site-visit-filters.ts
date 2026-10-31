import type { Prisma, SiteVisitStatus } from "@prisma/client";
import { activeVisitWhere } from "@/lib/project-visibility";

export const visitStatuses = { CAPTURED: "Captured", QUOTED: "Quoted" };

export function visitStatus(value?: string | null): SiteVisitStatus | undefined {
  return value && Object.hasOwn(visitStatuses, value) ? value as SiteVisitStatus : undefined;
}

export function siteVisitWhere({ company, search, status }: { company?: string; search: string; status?: SiteVisitStatus }): Prisma.SiteVisitWhereInput {
  return {
    AND: [activeVisitWhere],
    ...(company && { companyId: company }),
    ...(status && { status }),
    ...(search && { OR: [
      { title: { contains: search, mode: "insensitive" } },
      { location: { contains: search, mode: "insensitive" } },
      { contactName: { contains: search, mode: "insensitive" } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { project: { name: { contains: search, mode: "insensitive" } } },
    ] }),
  };
}
