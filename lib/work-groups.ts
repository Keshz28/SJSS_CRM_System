import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const workGroupDetailsSchema = z.object({
  name: z.string().trim().min(1, "Give the group a name.").max(100),
  description: z.string().trim().max(500).default(""),
  memberIds: z.array(z.string().min(1).max(128)).min(1).max(100),
}).strict();
export const newWorkGroupSchema = workGroupDetailsSchema.extend({
  companyId: z.string().min(1).max(128), projectId: z.string().max(128).nullish(),
});
export const workGroupMessageSchema = z.object({
  body: z.string().trim().min(1, "Write a message first.").max(4000),
  isAnnouncement: z.boolean().default(false), clientRequestId: z.string().uuid(),
}).strict();
export class WorkGroupError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function workGroupFailure(error: unknown) {
  if (error instanceof WorkGroupError) return { error: error.message, status: error.status };
  if (error instanceof z.ZodError) return { error: error.issues[0].message, status: 400 };
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
    return { error: "This send key has already been used. Review the message before retrying.", status: 409 };
  console.error("Work group request failed", error);
  return { error: "Could not complete the group request. Please try again.", status: 500 };
}
export const workGroupWhere = (userId: string, companyId = "") => ({
  members: { some: { userId } }, ...(companyId && { companyId }),
});
export async function listWorkGroups(userId: string, companyId = "", search = "", requestedPage = 1) {
  const where: Prisma.WorkGroupWhereInput = {
    ...workGroupWhere(userId, companyId),
    ...(search && { OR: [{ name: { contains: search, mode: "insensitive" } }, { description: { contains: search, mode: "insensitive" } }, { project: { name: { contains: search, mode: "insensitive" } } }] }),
  };
  const total = await prisma.workGroup.count({ where });
  const pages = Math.max(1, Math.ceil(total / 20));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, pages) : 1;
  const groups = await prisma.workGroup.findMany({
    where, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], skip: (page - 1) * 20, take: 20,
    include: { company: { select: { name: true } }, project: { select: { id: true, name: true } }, _count: { select: { members: true } }, messages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { body: true, authorName: true, isAnnouncement: true, createdAt: true } } },
  });
  return { groups, total, page, pages };
}
export async function getWorkGroup(id: string, userId: string, companyId = "", client: Prisma.TransactionClient = prisma) {
  const group = await client.workGroup.findFirst({
    where: { id, ...workGroupWhere(userId, companyId) },
    include: {
      company: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, deletedAt: true } },
      members: { orderBy: { joinedAt: "asc" }, select: { userId: true, user: { select: { name: true, isActive: true } } } },
    },
  });
  if (!group) throw new WorkGroupError("Group not found or you are no longer a member.", 404);
  return group;
}
export async function lockWorkGroup(tx: Prisma.TransactionClient, id: string) {
  // Serialize membership edits and sends so a removed member cannot send afterwards.
  await tx.$queryRaw(Prisma.sql`SELECT id FROM work_groups WHERE id = ${id} FOR UPDATE`);
}
export async function validateWorkGroupMembers(tx: Prisma.TransactionClient, ids: string[]) {
  const memberIds = [...new Set(ids)];
  const active = await tx.user.count({ where: { id: { in: memberIds }, isActive: true } });
  if (active !== memberIds.length) throw new WorkGroupError("Choose active users for this group.");
  return memberIds;
}
export async function workGroupMessages(groupId: string, params: URLSearchParams) {
  const after = params.get("after"), before = params.get("before");
  if (after && before) throw new WorkGroupError("Choose one message cursor.");
  const cursorId = after || before;
  if (cursorId && cursorId.length > 128) throw new WorkGroupError("Invalid message cursor.");
  const cursor = cursorId ? await prisma.workGroupMessage.findFirst({ where: { id: cursorId, groupId }, select: { id: true, createdAt: true } }) : null;
  if (cursorId && !cursor) throw new WorkGroupError("Message cursor not found in this group.");
  const ascending = Boolean(after);
  const where: Prisma.WorkGroupMessageWhereInput = {
    groupId, ...(params.get("view") === "announcements" && { isAnnouncement: true }),
    ...(cursor && { OR: [
      { createdAt: ascending ? { gt: cursor.createdAt } : { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: ascending ? { gt: cursor.id } : { lt: cursor.id } },
    ] }),
  };
  const messages = await prisma.workGroupMessage.findMany({
    where, orderBy: [{ createdAt: ascending ? "asc" : "desc" }, { id: ascending ? "asc" : "desc" }], take: 51,
    select: { id: true, authorId: true, authorName: true, body: true, isAnnouncement: true, createdAt: true, clientRequestId: true },
  });
  const page = messages.slice(0, 50);
  return { messages: ascending ? page : page.reverse(), hasMore: messages.length > 50 };
}
