import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { emailDeliveryConfigured, sendLoginCode } from "@/lib/email-delivery";
import { loginBucketKey } from "@/lib/login-throttle";

export const CODE_LIFETIME_MS = 10 * 60 * 1000;
export const CODE_ATTEMPTS = 5;
export function administratorEmailRequired() {
  return process.env.NODE_ENV === "production" || process.env.ADMIN_EMAIL_VERIFICATION === "true";
}
export class EmailVerificationError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
function digest(id: string, code: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Authentication is not configured");
  return createHmac("sha256", secret).update(`email-code:${id}:${code}`).digest("hex");
}

export async function issueEmailChallenge(user: { id: string; email: string; sessionVersion: number }) {
  if (!emailDeliveryConfigured()) throw new EmailVerificationError("Administrator email verification is not configured. Contact the system administrator.", 503);
  const id = randomUUID();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const now = new Date(), expiresAt = new Date(now.getTime() + CODE_LIFETIME_MS);
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73193, hashtext(${user.id}))`;
    const existing = await tx.emailLoginChallenge.findUnique({ where: { userId: user.id } });
    if (existing && now.getTime() - existing.createdAt.getTime() < 60_000)
      throw new EmailVerificationError("Wait one minute before requesting another code.", 429);
    const key = loginBucketKey(`email-send:${user.email}`);
    const hour = new Date(now.getTime() + 60 * 60 * 1000);
    const allowance = await tx.$queryRaw<{ attempts: number }[]>`
      INSERT INTO login_buckets (key, attempts, "expiresAt") VALUES (${key}, 1, ${hour})
      ON CONFLICT (key) DO UPDATE SET
        attempts = CASE WHEN login_buckets."expiresAt" <= ${now} THEN 1 ELSE login_buckets.attempts + 1 END,
        "expiresAt" = CASE WHEN login_buckets."expiresAt" <= ${now} THEN ${hour} ELSE login_buckets."expiresAt" END
      WHERE login_buckets."expiresAt" <= ${now} OR login_buckets.attempts < 5 RETURNING attempts`;
    if (!allowance.length) throw new EmailVerificationError("Too many verification emails requested. Try again later.", 429);
    await tx.emailLoginChallenge.upsert({
      where: { userId: user.id },
      create: { id, userId: user.id, codeHash: digest(id, code), expiresAt, createdAt: now, sessionVersion: user.sessionVersion },
      update: { id, codeHash: digest(id, code), expiresAt, createdAt: now, attempts: 0, sessionVersion: user.sessionVersion },
    });
  });
  try { await sendLoginCode(user.email, code, id); }
  catch {
    await prisma.emailLoginChallenge.deleteMany({ where: { id } });
    throw new EmailVerificationError("The verification email could not be sent. Please try again later.", 503);
  }
  return { challengeId: id, expiresIn: CODE_LIFETIME_MS / 1000, resendAfter: 60 };
}

export async function consumeEmailChallenge(user: { id: string; sessionVersion: number }, id: string, code: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^\d{6}$/.test(code)) return false;
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM email_login_challenges WHERE id = ${id} AND "userId" = ${user.id} FOR UPDATE`;
    const challenge = await tx.emailLoginChallenge.findFirst({ where: { id, userId: user.id } });
    if (!challenge || challenge.expiresAt <= new Date() || challenge.attempts >= CODE_ATTEMPTS || challenge.sessionVersion !== user.sessionVersion) return false;
    const valid = timingSafeEqual(Buffer.from(challenge.codeHash, "hex"), Buffer.from(digest(id, code), "hex"));
    if (!valid) {
      await tx.emailLoginChallenge.update({ where: { id }, data: { attempts: { increment: 1 } } });
      return false;
    }
    const updated = await tx.user.updateMany({ where: { id: user.id, isActive: true, role: "ADMIN", sessionVersion: user.sessionVersion }, data: { emailVerifiedAt: new Date() } });
    await tx.emailLoginChallenge.delete({ where: { id } });
    return updated.count === 1;
  });
}
