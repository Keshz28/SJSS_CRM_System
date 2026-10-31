import { randomUUID } from "node:crypto";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/request-body";
import { cloudStorageEnabled, storageBucket } from "@/lib/cloud-storage";
import { MAX_UPLOAD_SIZE, validUploadType } from "@/lib/file-storage";
import { signUploadTicket, uploadPurpose } from "@/lib/upload-ticket";
import { reserveLoginAttempt } from "@/lib/login-throttle";
import { activeVisitWhere } from "@/lib/project-visibility";

const schema = z.object({
  purpose: uploadPurpose,
  name: z.string().min(1).max(200),
  type: z.string().max(150).refine(validUploadType, "Unsupported file type"),
  size: z.number().int().positive().max(MAX_UPLOAD_SIZE),
  metadata: z.record(z.string().max(100), z.string().max(10000)).refine((value) => Object.keys(value).length <= 16),
});
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: "Choose a supported file up to 50 MB." }, { status: 400 });
  const input = parsed.data;
  if (input.purpose !== "attachment" && input.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Documents must be no larger than 10 MB." }, { status: 400 });
  if (input.purpose === "attachment") {
    const { quotationId, siteVisitId } = input.metadata;
    if (Boolean(quotationId) === Boolean(siteVisitId)) return NextResponse.json({ error: "Choose one media owner." }, { status: 400 });
    const owner = siteVisitId
      ? await prisma.siteVisit.findFirst({ where: { id: siteVisitId, ...activeVisitWhere } })
      : await prisma.quotation.findUnique({ where: { id: quotationId } });
    if (!owner) return NextResponse.json({ error: "Record not found" }, { status: 404 });
    if (owner.createdById !== session.user.id && session.user.role !== "ADMIN") return NextResponse.json({ error: "Only the creator or an administrator can add files." }, { status: 403 });
  }
  if (!cloudStorageEnabled()) {
    if (process.env.VERCEL) return NextResponse.json({ error: "Private storage is not configured." }, { status: 503 });
    return NextResponse.json({ mode: "local" });
  }
  if (input.purpose === "extract" && !process.env.GEMINI_API_KEY) return NextResponse.json({ error: "Document auto-fill is unavailable. Please enter the details manually." }, { status: 503 });
  if (!await reserveLoginAttempt(`upload:${session.user.id}`, 60)) return NextResponse.json({ error: "Too many uploads. Please try again in 15 minutes." }, { status: 429 });
  try {
    const key = `pending/${randomUUID()}`;
    const { data, error } = await storageBucket(true).createSignedUploadUrl(key, { upsert: false });
    if (error || !data) throw new Error("Upload unavailable");
    const uploadTicket = signUploadTicket({ ...input, name: path.basename(input.name), key, userId: session.user.id, expires: Date.now() + 15 * 60 * 1000 });
    return NextResponse.json({ mode: "supabase", signedUrl: data.signedUrl, uploadTicket });
  } catch {
    return NextResponse.json({ error: "Private storage is unavailable. Please try again." }, { status: 503 });
  }
}
