import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { projectStatuses } from "@/lib/project-schema";

export const projectViews = {
  all: "All projects",
  pinned: "Pinned",
  starred: "Starred",
  deleted: "Recently deleted",
};
export type ProjectView = keyof typeof projectViews;
export function projectView(value?: string | null): ProjectView {
  return value && Object.hasOwn(projectViews, value) ? value as ProjectView : "all";
}

export async function listProjects({ userId, companyId = "", search = "", status, view = "all", page = 1, limit = 20 }: {
  userId: string; companyId?: string; search?: string; status?: string;
  view?: ProjectView; page?: number; limit?: number;
}) {
  const conditions = [view === "deleted" ? Prisma.sql`p."deletedAt" IS NOT NULL` : Prisma.sql`p."deletedAt" IS NULL`];
  if (companyId) conditions.push(Prisma.sql`p."companyId" = ${companyId}`);
  if (status && Object.hasOwn(projectStatuses, status)) conditions.push(Prisma.sql`p.status = ${status}::"ProjectStatus"`);
  if (search.trim()) {
    const pattern = `%${search.trim().replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(Prisma.sql`(p.name ILIKE ${pattern} OR p.location ILIKE ${pattern})`);
  }
  if (view === "pinned") conditions.push(Prisma.sql`pref."isPinned" = true`);
  if (view === "starred") conditions.push(Prisma.sql`pref."isStarred" = true`);
  const from = Prisma.sql`FROM projects p
    LEFT JOIN project_preferences pref ON pref."projectId" = p.id AND pref."userId" = ${userId}
    WHERE ${Prisma.join(conditions, " AND ")}`;
  const order = view === "deleted" ? Prisma.sql`p."deletedAt" DESC, p.id ASC`
    : Prisma.sql`COALESCE(pref."isPinned", false) DESC, COALESCE(pref."isStarred", false) DESC, p."updatedAt" DESC, p.id ASC`;
  // Sort in the database before pagination so a pin on a later page moves to page 1.
  const [ids, counts] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT p.id ${from}
      ORDER BY ${order} LIMIT ${limit} OFFSET ${(page - 1) * limit}`),
    prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`SELECT count(*) AS total ${from}`),
  ]);
  const projects = await prisma.project.findMany({
    where: { id: { in: ids.map((p) => p.id) } },
    include: {
      company: { select: { name: true } }, customer: { select: { name: true } },
      preferences: { where: { userId }, select: { isPinned: true, isStarred: true } },
      _count: { select: { siteVisits: true } },
    },
  });
  const byId = new Map(projects.map(({ preferences, ...project }) => [project.id, {
    ...project, isPinned: preferences[0]?.isPinned || false, isStarred: preferences[0]?.isStarred || false,
  }]));
  return {
    projects: ids.flatMap(({ id }) => { const p = byId.get(id); return p ? [p] : []; }),
    total: Number(counts[0]?.total || 0),
  };
}
