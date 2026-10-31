import { Prisma } from "@prisma/client";
import { z } from "zod";

const decimal = (maximum: number) => z.number().finite().min(0).max(maximum)
  .refine((value) => new Prisma.Decimal(value).decimalPlaces() <= 2, "Use at most two decimal places");
export const quotationItemSchema = z.object({
  description: z.string().trim().min(1).max(4000),
  quantity: decimal(99_999_999.99).refine((value) => value > 0, "Quantity must be positive"),
  unitPrice: decimal(9_999_999_999.99),
  order: z.number().int().min(0).max(10000).default(0),
}).refine((item) => lineTotal(item).lte("9999999999.99"), "Line total is too large");

const items = z.array(quotationItemSchema).min(1).max(500)
  .refine((values) => quotationTotal(values).lte("9999999999.99"), "Quotation total is too large");
const validUntil = z.string().max(40).refine((value) => {
  if (value === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*Z)?$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value.slice(0, 10);
}, "Choose a valid date");
const fields = {
  customerId: z.string().min(1).max(200),
  subject: z.string().max(500).optional(),
  notes: z.string().max(20000).optional(),
  terms: z.string().max(20000).optional(),
  validUntil: validUntil.optional(),
  items,
};
export const quotationCreateSchema = z.object({ ...fields, companyId: z.string().min(1).max(200) });
export const quotationUpdateSchema = z.object(fields).partial().extend({
  validUntil: validUntil.nullable().optional(),
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED"]).optional(),
});
export function quotationTotal(values: { quantity: number; unitPrice: number }[]) {
  return values.reduce((sum, item) => sum.add(lineTotal(item)), new Prisma.Decimal(0));
}
export function lineTotal(item: { quantity: number; unitPrice: number }) {
  return new Prisma.Decimal(item.quantity).mul(item.unitPrice).toDecimalPlaces(2);
}
