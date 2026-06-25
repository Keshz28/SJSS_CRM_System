import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";

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

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const isPDF = file.type === "application/pdf";
  const isImage = file.type.startsWith("image/");

  if (!isPDF && !isImage) {
    return NextResponse.json({ error: "Only PDF and image files support auto-fill" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");

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

  const raw = result.response.text().trim();

  try {
    const cleaned = raw.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
    const extracted = JSON.parse(cleaned);
    return NextResponse.json(extracted);
  } catch {
    return NextResponse.json({ error: "Could not parse response", raw }, { status: 422 });
  }
}
