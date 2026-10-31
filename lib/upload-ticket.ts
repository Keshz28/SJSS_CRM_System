import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const uploadPurpose = z.enum(["attachment", "import", "extract"]);
export const ticketSchema = z.object({
  userId: z.string().min(1),
  purpose: uploadPurpose,
  key: z.string().regex(/^pending\/[0-9a-f-]{36}$/),
  name: z.string().min(1).max(200),
  type: z.string().min(1).max(150),
  size: z.number().int().positive().max(50 * 1024 * 1024),
  metadata: z.record(z.string().max(100), z.string().max(10000)),
  expires: z.number().int(),
});
type Ticket = z.infer<typeof ticketSchema>;
function signature(payload: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("Upload signing is not configured");
  return createHmac("sha256", secret).update(`crm-upload-v1:${payload}`).digest();
}
export function signUploadTicket(ticket: Ticket) {
  const payload = Buffer.from(JSON.stringify(ticketSchema.parse(ticket))).toString("base64url");
  return `${payload}.${signature(payload).toString("base64url")}`;
}
export function verifyUploadTicket(value: string, userId: string, purpose: Ticket["purpose"]) {
  if (value.length > 100000) throw new Error("Invalid upload ticket");
  const parts = value.split(".");
  if (parts.length !== 2) throw new Error("Invalid upload ticket");
  const actual = Buffer.from(parts[1], "base64url"), expected = signature(parts[0]);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("Invalid upload ticket");
  const ticket = ticketSchema.parse(JSON.parse(Buffer.from(parts[0], "base64url").toString()));
  if (ticket.userId !== userId || ticket.purpose !== purpose || ticket.expires <= Date.now()) throw new Error("Upload ticket expired or belongs to another request");
  return ticket;
}
