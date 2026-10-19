import { readForm } from "@/lib/request-body";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { FileValidationError, removeUnreferencedFile, storeFile } from "@/lib/file-storage";
import { createImportedQuotation, quotationImportFailure, quotationImportSchema } from "@/lib/quotation-import";

const ALLOWED_TYPES = [
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg", "image/png",
];
const MAX_SIZE = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let form: FormData;
  try { form = await readForm(req, 11 * 1024 * 1024); }
  catch { return NextResponse.json({ error: "Choose a valid document upload." }, { status: 400 }); }
  const parsed = quotationImportSchema.safeParse(Object.fromEntries([
    "companyId", "companyName", "quotationNumber", "subject", "amount", "date", "status", "notes",
  ].map((key) => [key, form.get(key) ?? undefined])));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const file = form.get("file");
  if (file !== null && (!(file instanceof File) || !ALLOWED_TYPES.includes(file.type) || !file.size || file.size > MAX_SIZE))
    return NextResponse.json({ error: "Choose a non-empty PDF, Excel, Word or JPG/PNG file up to 10 MB." }, { status: 400 });

  let stored: Awaited<ReturnType<typeof storeFile>> | undefined;
  if (file instanceof File) {
    try { stored = await storeFile(file); }
    catch (error) {
      if (error instanceof FileValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
      console.error("Could not store imported document", error);
      return NextResponse.json({ error: "Could not store the document. Please try again." }, { status: 503 });
    }
  }
  try {
    const quotation = await createImportedQuotation(parsed.data, session.user.id, stored);
    return NextResponse.json(quotation, { status: 201 });
  } catch (error) {
    if (stored) await removeUnreferencedFile(stored.filepath).catch((cleanupError) => console.error("Import file cleanup failed", cleanupError));
    const failure = quotationImportFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
