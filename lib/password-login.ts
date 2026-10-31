import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { reserveLoginAttempt } from "@/lib/login-throttle";
import { z } from "zod";

const dummyHash = bcrypt.hashSync("unused-authentication-comparison", 12);
export const passwordLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72),
});
export async function verifyPassword(input: unknown) {
  const parsed = passwordLoginSchema.safeParse(input);
  if (!parsed.success || !(await reserveLoginAttempt(parsed.data.email))) return null;
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const valid = await bcrypt.compare(parsed.data.password, user?.isActive ? user.passwordHash : dummyHash);
  return user?.isActive && valid ? user : null;
}
