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
];

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const quotationId = formData.get("quotationId") as string | null;

  if (!file || !quotationId) {
    return NextResponse.json({ error: "File and quotationId are required" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const uploadDir = path.join(process.cwd(), "public", "uploads", quotationId);
  await mkdir(uploadDir, { recursive: true });

  const ext = path.extname(file.name);
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const filePath = path.join(uploadDir, safeName);

  await writeFile(filePath, buffer);

  const relativePath = `uploads/${quotationId}/${safeName}`;

  const attachment = await prisma.attachment.create({
    data: {
      quotationId,
      filename: file.name,
      filepath: relativePath,
      filesize: file.size,
      mimetype: file.type,
    },
  });

  return NextResponse.json(attachment, { status: 201 });
}
