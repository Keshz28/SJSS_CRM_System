import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stat, storedFilePath } from "@/lib/file-storage";
import { createReadStream } from "fs";
import { Readable } from "stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  req: NextRequest,
  { params: pendingParams }: { params: Promise<{ id: string }> },
) {
  const params = await pendingParams;
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const attachment = await prisma.attachment.findUnique({
    where: { id: params.id },
  });
  if (!attachment)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const filepath = storedFilePath(attachment.filepath);
  const file = await stat(filepath).catch(() => null);
  if (!file)
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  const headers: Record<string, string> = {
    "Content-Type": attachment.mimetype,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    "Content-Security-Policy": "sandbox",
    "Content-Disposition": `${req.nextUrl.searchParams.has("download") || !/^(image|video|audio)\//.test(attachment.mimetype) ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
  };
  let start = 0,
    end = file.size - 1;
  const range = req.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2]))
      return new NextResponse(null, {
        status: 416,
        headers: { ...headers, "Content-Range": `bytes */${file.size}` },
      });
    start = match[1]
      ? Number(match[1])
      : Math.max(0, file.size - Number(match[2]));
    end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
    if (start > end || start >= file.size)
      return new NextResponse(null, {
        status: 416,
        headers: { ...headers, "Content-Range": `bytes */${file.size}` },
      });
    headers["Content-Range"] = `bytes ${start}-${end}/${file.size}`;
  }
  headers["Content-Length"] = String(end - start + 1);
  const stream = Readable.toWeb(
    createReadStream(filepath, { start, end }),
  ) as ReadableStream<Uint8Array>;
  return new NextResponse(stream, { status: range ? 206 : 200, headers });
}
