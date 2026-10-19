import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";

/**
 * Generates the next quotation number for a given company, e.g. "SJSS-2026-0001".
 * Each company has its own independent yearly sequence.
 */
export async function generateQuotationNumber(
  companyId: string,
  client: Prisma.TransactionClient = prisma,
): Promise<string> {
  const year = Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Kuala_Lumpur", year: "numeric" }).format(new Date()));

  const company = await client.company.findUnique({
    where: { id: companyId },
    select: { prefix: true },
  });
  if (!company) {
    throw new Error("Company not found — cannot generate quotation number.");
  }

  const prefix = `${company.prefix}-${year}-`;
  // Imported historical references may be ahead of the current counter. Advance
  // past both those references and all previously issued/deleted sequence values.
  const existing = await client.$queryRaw<{ maximum: bigint }[]>`
    SELECT COALESCE(MAX(substring("quotationNumber" from char_length(${prefix}) + 1)::bigint), 0) AS maximum
    FROM quotations WHERE "companyId" = ${companyId}
      AND starts_with("quotationNumber", ${prefix})
      AND substring("quotationNumber" from char_length(${prefix}) + 1) ~ '^[0-9]{1,9}$'`;
  const baseline = Number(existing[0]?.maximum || 0);
  const sequence = await client.$queryRaw<{ value: number }[]>`
    INSERT INTO quotation_sequences (id, "companyId", year, value)
    VALUES (${randomUUID()}, ${companyId}, ${year}, ${baseline + 1})
    ON CONFLICT ("companyId", year) DO UPDATE
      SET value = GREATEST(quotation_sequences.value, ${baseline}) + 1
    RETURNING value`;
  const value = sequence[0].value;

  const padded = String(value).padStart(4, "0");
  return `${company.prefix}-${year}-${padded}`;
}
