import type { Prisma } from "@prisma/client";

/** Standalone visits and visits in active projects remain in normal workflows. */
export const activeVisitWhere: Prisma.SiteVisitWhereInput = {
  OR: [{ projectId: null }, { project: { deletedAt: null } }],
};
