import { prisma } from "@/lib/prisma";

/**
 * Generates the next quotation number for a given company, e.g. "SJSS-2026-0001".
 * Each company has its own independent yearly sequence.
 */
export async function generateQuotationNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear();

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { prefix: true },
  });
  if (!company) {
    throw new Error("Company not found — cannot generate quotation number.");
  }

  const value = await prisma.$transaction(async (tx) => {
    const seq = await tx.quotationSequence.upsert({
      where: { companyId_year: { companyId, year } },
      update: { value: { increment: 1 } },
      create: { companyId, year, value: 1 },
    });
    return seq.value;
  });

  const padded = String(value).padStart(4, "0");
  return `${company.prefix}-${year}-${padded}`;
}
