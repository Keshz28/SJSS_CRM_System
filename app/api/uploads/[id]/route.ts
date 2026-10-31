import { readJson } from "@/lib/request-body";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { removeUnreferencedFile } from "@/lib/file-storage";
import { z } from "zod";

async function editable(id: string, user: { id: string; role: string }) {
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: {
      siteVisit: { select: { createdById: true, project: { select: { deletedAt: true } } } },
      quotation: { select: { createdById: true } },
    },
  });
  if (!attachment || attachment.siteVisit?.project?.deletedAt) return null;
  if (
    user.role !== "ADMIN" &&
    (attachment.uploadedById ||
      attachment.siteVisit?.createdById ||
      attachment.quotation?.createdById) !== user.id
  )
    return false;
  return attachment;
}
export async function DELETE(
  _req: NextRequest,
  { params: pendingParams }: { params: Promise<{ id: string }> },
) {
  const params = await pendingParams;
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const attachment = await editable(params.id, session.user);
  if (!attachment)
    return NextResponse.json(
      {
        error:
          attachment === false
            ? "Only the uploader or an administrator can remove this media."
            : "Not found",
      },
      { status: attachment === false ? 403 : 404 },
    );
  await prisma.attachment.delete({ where: { id: params.id } });
  await removeUnreferencedFile(attachment.filepath);
  return NextResponse.json({ success: true });
}
export async function PATCH(
  req: NextRequest,
  { params: pendingParams }: { params: Promise<{ id: string }> },
) {
  const params = await pendingParams;
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const attachment = await editable(params.id, session.user);
  if (!attachment)
    return NextResponse.json(
      { error: "You cannot edit this media." },
      { status: attachment === false ? 403 : 404 },
    );
  const parsed = z
    .object({ caption: z.string().trim().max(1000) })
    .safeParse(await readJson(req));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Caption must be under 1000 characters." },
      { status: 400 },
    );
  return NextResponse.json(
    await prisma.attachment.update({
      where: { id: params.id },
      data: { caption: parsed.data.caption || null },
    }),
  );
}
