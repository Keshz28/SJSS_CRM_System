import { z } from "zod";
import { customerDetailsSchema } from "./customer-schema";
export const projectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(160),
  companyId: z.string().min(1),
  customerId: z.string().nullable().optional(),
  newCustomer: customerDetailsSchema.optional(),
  location: z.string().trim().max(500).optional(),
  description: z.string().trim().max(5000).optional(),
  status: z
    .enum(["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED"])
    .default("PLANNED"),
});
export const projectStatuses = {
  PLANNED: "Planned",
  ACTIVE: "In progress",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
};
