import { readJson } from "@/lib/request-body";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { quotationImportSchema, createImportedQuotation, quotationImportFailure } from "@/lib/quotation-import";

const importSchema = quotationImportSchema.array().min(1).max(500);

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await readJson(req); }
  catch { return NextResponse.json({ error: "Provide valid JSON import rows." }, { status: 400 }); }
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  let imported = 0;
  const errors: { row: string; index: number; error: string }[] = [];
  // Each row is a transaction: one failure does not undo earlier completed rows.
  for (const [index, row] of parsed.data.entries()) {
    try {
      await createImportedQuotation(row, session.user.id);
      imported++;
    } catch (error) {
      errors.push({ row: row.quotationNumber || row.companyName, index: index + 1, error: quotationImportFailure(error).error });
    }
  }
  return NextResponse.json({ imported, errors });
}
