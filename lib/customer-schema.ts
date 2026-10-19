import { z } from "zod";

export const customerDetailsSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required").max(200),
  contactPerson: z.string().trim().max(200).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().max(80).optional(),
  address: z.string().trim().max(1000).optional(),
  city: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(5000).optional(),
});
export const customerSchema = customerDetailsSchema.extend({
  companyId: z.string().min(1, "Choose the company this customer belongs to"),
});
