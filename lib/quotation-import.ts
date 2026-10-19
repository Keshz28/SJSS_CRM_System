import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateQuotationNumber } from "@/lib/quotation-number";
import type { storeFile } from "@/lib/file-storage";

const amountSchema = z.union([
  z.number().finite(),
  z.string().trim().min(1).max(32).regex(/^\d+(?:\.\d{1,2})?$/, "Enter a valid amount with at most two decimal places."),
]).transform((value) => new Prisma.Decimal(value))
  .refine((value) => value.gte(0) && value.lte("9999999999.99"), "Amount is outside the supported range.")
  .refine((value) => value.decimalPlaces() <= 2, "Amount must have at most two decimal places.");

export const quotationImportSchema = z.object({
  companyId: z.string().trim().min(1, "Company is required."),
  companyName: z.string().trim().min(1, "Customer name is required.").max(200),
  quotationNumber: z.string().trim().max(100).default(""),
  subject: z.string().trim().max(500).default(""),
  amount: amountSchema,
  date: z.string().trim().max(10).default("").refine((value) => {
    if (!value) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Enter a valid document date in YYYY-MM-DD format."),
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED"]).default("DRAFT"),
  notes: z.string().trim().max(10000).default(""),
});

export class QuotationImportError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export function quotationImportFailure(error: unknown) {
  if (error instanceof QuotationImportError) return { error: error.message, status: error.status };
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
    return { error: "This quotation reference already exists. Review the existing record before importing it again.", status: 409 };
  console.error("Quotation import failed", error);
  return { error: "Could not save the quotation. Please try again.", status: 500 };
}

export async function createImportedQuotation(row: z.output<typeof quotationImportSchema>, userId: string, file?: Awaited<ReturnType<typeof storeFile>>) {
  // Customer, number sequence, quotation, line item and attachment commit together.
  return prisma.$transaction(async (tx) => {
    if (!(await tx.company.findUnique({ where: { id: row.companyId }, select: { id: true } })))
      throw new QuotationImportError("Selected company not found.", 400);
    if (row.quotationNumber && await tx.quotation.findUnique({ where: { quotationNumber: row.quotationNumber }, select: { id: true } }))
      throw new QuotationImportError(`Quotation number “${row.quotationNumber}” already exists.`, 409);

    const customer = await tx.customer.findFirst({
      where: { companyId: row.companyId, isActive: true, name: { equals: row.companyName, mode: "insensitive" } },
    }) || await tx.customer.create({ data: { name: row.companyName, companyId: row.companyId } });
    const quotationNumber = row.quotationNumber || await generateQuotationNumber(row.companyId, tx);
    return tx.quotation.create({
      data: {
        quotationNumber, companyId: row.companyId, customerId: customer.id,
        subject: row.subject || null, notes: row.notes || null, totalAmount: row.amount,
        status: row.status, createdById: userId,
        // Existing imports use createdAt as the historical date, in Malaysia time.
        ...(row.date && { createdAt: new Date(`${row.date}T00:00:00+08:00`) }),
        items: { create: [{ description: row.subject || "Imported quotation", quantity: 1, unitPrice: row.amount, total: row.amount, order: 0 }] },
        ...(file && { attachments: { create: { ...file, uploadedById: userId } } }),
      },
      select: { id: true, quotationNumber: true },
    });
  });
}
