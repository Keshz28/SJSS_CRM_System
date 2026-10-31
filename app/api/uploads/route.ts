import { readUploadForm } from "@/lib/upload-form";
import { activeVisitWhere } from "@/lib/project-visibility";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FileValidationError, removeUnreferencedFile, storeFile } from "@/lib/file-storage";
import { z } from "zod";

export const maxDuration = 120;

const metaSchema = z
  .object({
    quotationId: z
      .string()
      .regex(/^[a-zA-Z0-9_-]+$/)
      .nullable(),
    siteVisitId: z
      .string()
      .regex(/^[a-zA-Z0-9_-]+$/)
      .nullable(),
    caption: z.string().trim().max(1000),
    clientUploadId: z.string().uuid().nullable(),
  })
  .refine(
    (d) => Boolean(d.quotationId) !== Boolean(d.siteVisitId),
    "Choose one media owner",
  );

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let form: FormData;
  try { form = await readUploadForm(req, session.user.id, "attachment"); }
  catch { return NextResponse.json({ error: "The upload could not be verified. Please upload the file again." }, { status: 400 }); }
  const file = form.get("file");
  const parsed = metaSchema.safeParse({
    quotationId: form.get("quotationId") || null,
    siteVisitId: form.get("siteVisitId") || null,
    caption: form.get("caption") || "",
    clientUploadId: form.get("clientUploadId") || null,
  });
  if (!(file instanceof File) || !parsed.success)
    return NextResponse.json(
      { error: "A file and one valid visit or quotation are required." },
      { status: 400 },
    );
  const { quotationId, siteVisitId, caption, clientUploadId } = parsed.data;
  const owner = siteVisitId
    ? await prisma.siteVisit.findFirst({ where: { id: siteVisitId, ...activeVisitWhere } })
    : await prisma.quotation.findUnique({ where: { id: quotationId! } });
  if (!owner)
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  if (owner.createdById !== session.user.id && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Only the creator or an administrator can add files to this record." }, { status: 403 });
  const existing = clientUploadId
    ? await prisma.attachment.findUnique({ where: { clientUploadId } })
    : null;
  if (existing) {
    if (
      existing.uploadedById !== session.user.id ||
      existing.siteVisitId !== siteVisitId ||
      existing.quotationId !== quotationId
    )
      return NextResponse.json(
        { error: "Upload key already used" },
        { status: 409 },
      );
    return NextResponse.json(existing);
  }
  let stored: Awaited<ReturnType<typeof storeFile>>;
  try {
    stored = await storeFile(file);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof FileValidationError ? error.message : "Could not store the file. Please try again." },
      { status: error instanceof FileValidationError ? 400 : 503 },
    );
  }
  try {
    const attachment = await prisma.attachment.create({
      data: {
        ...stored,
        quotationId,
        siteVisitId,
        caption: caption || null,
        clientUploadId,
        uploadedById: session.user.id,
      },
    });
    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    await removeUnreferencedFile(stored.filepath);
    // A retry can arrive before the first request's response reaches the phone.
    const duplicate = clientUploadId
      ? await prisma.attachment.findUnique({ where: { clientUploadId } })
      : null;
    if (
      duplicate?.uploadedById === session.user.id &&
      duplicate.siteVisitId === siteVisitId &&
      duplicate.quotationId === quotationId
    )
      return NextResponse.json(duplicate);
    throw error;
  }
}
