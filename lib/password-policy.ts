import { z } from "zod";

// bcrypt only considers the first 72 UTF-8 bytes. Reject longer inputs instead
// of silently allowing two different passwords to authenticate as the same one.
export const passwordSchema = z.string()
  .min(15, "Use a passphrase of at least 15 characters")
  .max(72, "Password must fit within 72 UTF-8 bytes")
  .refine((value) => new TextEncoder().encode(value).length <= 72, "Password must fit within 72 UTF-8 bytes");
