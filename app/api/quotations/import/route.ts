import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateQuotationNumber } from "@/lib/quotation-number";
import { z } from "zod";

const rowSchema = z.object({
  quotationNumber: z.string().optional(),
  companyId: z.string().min(1, "Company is required"),
  companyName: z.string().min(1, "Company name is required"),
  subject: z.string().optional(),
  amount: z.number().min(0, "Amount must be 0 or more"),
  date: z.string().optional(),
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED"]).default("SENT"),
  notes: z.string().optional(),
});

const importSchema = z.array(rowSchema).min(1).max(500);

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const imported: { quotationNumber: string; customer: string }[] = [];
  const errors: { row: string; error: string }[] = [];

  for (const row of parsed.data) {
    try {
      const company = await prisma.company.findUnique({ where: { id: row.companyId } });
      if (!company) {
        errors.push({ row: row.quotationNumber || row.companyName, error: "Selected company not found — skipped" });
        continue;
      }

      let customer = await prisma.customer.findFirst({
        where: { name: { equals: row.companyName, mode: "insensitive" } },
      });
      if (!customer) {
        customer = await prisma.customer.create({ data: { name: row.companyName } });
      }

      let quotationNumber = row.quotationNumber?.trim() || "";
      if (!quotationNumber) {
        quotationNumber = await generateQuotationNumber(row.companyId);
      } else {
        const existing = await prisma.quotation.findUnique({ where: { quotationNumber } });
        if (existing) {
          errors.push({ row: quotationNumber, error: `Quotation number "${quotationNumber}" already exists — skipped` });
          continue;
        }
      }

      const createdAt = row.date ? new Date(row.date) : new Date();

      await prisma.quotation.create({
        data: {
          quotationNumber,
          customerId: customer.id,
          companyId: row.companyId,
          subject: row.subject || null,
          notes: row.notes || null,
          totalAmount: row.amount,
          status: row.status,
          createdAt,
          updatedAt: createdAt,
          createdById: session.user.id,
          items: {
            create: [
              {
                description: row.subject || "Imported quotation",
                quantity: 1,
                unitPrice: row.amount,
                total: row.amount,
                order: 0,
              },
            ],
          },
        },
      });

      imported.push({ quotationNumber, customer: customer.name });
    } catch (err) {
      errors.push({
        row: row.quotationNumber || row.companyName,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ imported: imported.length, errors });
}
