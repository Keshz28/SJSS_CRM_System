import { readForm } from "@/lib/request-body";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { FileValidationError, readValidatedFile } from "@/lib/file-storage";
import { quotationImportSchema } from "@/lib/quotation-import";

const extractedSchema = z.object({
  quotationNumber: quotationImportSchema.shape.quotationNumber.nullish(),
  companyName: quotationImportSchema.shape.companyName.nullish(),
  subject: quotationImportSchema.shape.subject.nullish(),
  amount: quotationImportSchema.shape.amount.nullish(),
  date: quotationImportSchema.shape.date.nullish(),
});

const PROMPT = `Extract these fields from the quotation document and return ONLY valid JSON, nothing else:
{
  "quotationNumber": "the quote/quotation reference number",
  "companyName": "the CUSTOMER name — the person or company RECEIVING the quote (not SJSS or SJ Sunrise Services)",
  "subject": "brief description of what the quotation is for",
  "amount": <total amount as a plain number, no currency symbol or commas>,
  "date": "date in YYYY-MM-DD format"
}
Use null for any field you cannot find. Return only the JSON object.`;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try { formData = await readForm(req, 11 * 1024 * 1024); }
  catch { return NextResponse.json({ error: "Choose a valid document upload." }, { status: 400 }); }
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024)
    return NextResponse.json({ error: "Choose a non-empty PDF or JPG/PNG file up to 10 MB." }, { status: 400 });

  const isPDF = file.type === "application/pdf";
  const isImage = ["image/jpeg", "image/png"].includes(file.type);

  if (!isPDF && !isImage) {
    return NextResponse.json({ error: "Only PDF and image files support auto-fill" }, { status: 400 });
  }

  let base64: string;
  try { base64 = (await readValidatedFile(file)).bytes.toString("base64"); }
  catch (error) {
    if (error instanceof FileValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Could not read the document. Please try again." }, { status: 400 });
  }
  if (!process.env.GEMINI_API_KEY)
    return NextResponse.json({ error: "Document auto-fill is unavailable. Please enter the details manually." }, { status: 503 });

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  let result;
  try {
    result = await model.generateContent([
      { inlineData: { mimeType: file.type as string, data: base64 } },
      PROMPT,
    ]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("429") || msg.includes("quota")) {
      return NextResponse.json({ error: "Gemini quota exceeded — please try again in a minute, or fill in the fields manually." }, { status: 429 });
    }
    return NextResponse.json({ error: "Gemini API error — please fill in the fields manually." }, { status: 502 });
  }

  try {
    const raw = result.response.text().trim();
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    const extracted = extractedSchema.parse(JSON.parse(cleaned));
    return NextResponse.json({ ...extracted, amount: extracted.amount?.toNumber() ?? null });
  } catch {
    return NextResponse.json({ error: "Could not read reliable document details. Please enter them manually." }, { status: 422 });
  }
}
