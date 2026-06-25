import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  // Video (site walkthroughs)
  "video/mp4",
  "video/quicktime", // iPhone .mov
  "video/webm",
  "video/3gpp",
  "video/x-matroska",
];

// Generous ceiling so phone videos fit. This is a safety valve against a
// runaway upload, not a product limit — raise it freely. NOTE: large videos
// should move to direct Supabase Storage uploads (Phase 5); the current route
// buffers the whole file in memory, which is fine locally but not serverless.
const MAX_SIZE = 250 * 1024 * 1024; // 250 MB

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const quotationId = (formData.get("quotationId") as string | null) || null;
  const siteVisitId = (formData.get("siteVisitId") as string | null) || null;

  if (!file || (!quotationId && !siteVisitId)) {
    return NextResponse.json(
      { error: "File and a quotationId or siteVisitId are required" },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 15 MB)" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Folder is named by whichever owner the attachment belongs to.
  const ownerFolder = quotationId ?? siteVisitId!;
  const uploadDir = path.join(process.cwd(), "public", "uploads", ownerFolder);
  await mkdir(uploadDir, { recursive: true });

  const ext = path.extname(file.name);
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const filePath = path.join(uploadDir, safeName);

  await writeFile(filePath, buffer);

  const relativePath = `uploads/${ownerFolder}/${safeName}`;

  const attachment = await prisma.attachment.create({
    data: {
      quotationId,
      siteVisitId,
      filename: file.name,
      filepath: relativePath,
      filesize: file.size,
      mimetype: file.type,
    },
  });

  return NextResponse.json(attachment, { status: 201 });
}
