import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateQuotationNumber } from "@/lib/quotation-number";
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
];

const MAX_SIZE = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();

  const file = formData.get("file") as File | null;
  const quotationNumber = (formData.get("quotationNumber") as string | null)?.trim() || "";
  const companyId = (formData.get("companyId") as string | null)?.trim() || "";
  const companyName = (formData.get("companyName") as string | null)?.trim() || "";
  const subject = (formData.get("subject") as string | null)?.trim() || "";
  const amountRaw = (formData.get("amount") as string | null) ?? "";
  const dateRaw = (formData.get("date") as string | null)?.trim() || "";
  const status = (formData.get("status") as string | null)?.trim() || "SENT";
  const notes = (formData.get("notes") as string | null)?.trim() || "";

  if (!companyId) {
    return NextResponse.json({ error: "Please select which company this quotation is for" }, { status: 400 });
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    return NextResponse.json({ error: "Selected company not found" }, { status: 400 });
  }

  if (!companyName) {
    return NextResponse.json({ error: "Company name is required" }, { status: 400 });
  }

  const amount = parseFloat(amountRaw);
  if (isNaN(amount) || amount < 0) {
    return NextResponse.json({ error: "Amount must be a valid number" }, { status: 400 });
  }

  if (file && !ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
  }

  if (file && file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
  }

  // Find or create customer
  let customer = await prisma.customer.findFirst({
    where: { name: { equals: companyName, mode: "insensitive" } },
  });
  if (!customer) {
    customer = await prisma.customer.create({ data: { name: companyName } });
  }

  // Resolve quotation number
  let finalQuotationNumber = quotationNumber;
  if (!finalQuotationNumber) {
    finalQuotationNumber = await generateQuotationNumber(companyId);
  } else {
    const existing = await prisma.quotation.findUnique({ where: { quotationNumber: finalQuotationNumber } });
    if (existing) {
      return NextResponse.json({ error: `Quotation number "${finalQuotationNumber}" already exists` }, { status: 409 });
    }
  }

  const createdAt = dateRaw ? new Date(dateRaw) : new Date();

  // Create quotation with one line item
  const quotation = await prisma.quotation.create({
    data: {
      quotationNumber: finalQuotationNumber,
      customerId: customer.id,
      companyId,
      subject: subject || null,
      notes: notes || null,
      totalAmount: amount,
      status: status as "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED",
      createdAt,
      updatedAt: createdAt,
      createdById: session.user.id,
      items: {
        create: [
          {
            description: subject || "Imported quotation",
            quantity: 1,
            unitPrice: amount,
            total: amount,
            order: 0,
          },
        ],
      },
    },
  });

  // Attach file if provided
  if (file) {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const uploadDir = path.join(process.cwd(), "public", "uploads", quotation.id);
    await mkdir(uploadDir, { recursive: true });
    const ext = path.extname(file.name);
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    await writeFile(path.join(uploadDir, safeName), buffer);
    await prisma.attachment.create({
      data: {
        quotationId: quotation.id,
        filename: file.name,
        filepath: `uploads/${quotation.id}/${safeName}`,
        filesize: file.size,
        mimetype: file.type,
      },
    });
  }

  return NextResponse.json({ id: quotation.id, quotationNumber: finalQuotationNumber }, { status: 201 });
}
