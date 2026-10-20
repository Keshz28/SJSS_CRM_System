import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";

const WINDOW_MS = 15 * 60 * 1000;
export const MAX_LOGIN_ATTEMPTS = 10;

export function loginBucketKey(email: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Authentication is not configured");
  return createHmac("sha256", secret).update(`login:${email}`).digest("hex");
}

/** Shared PostgreSQL counter: survives restarts and works across app instances. */
export async function reserveLoginAttempt(email: string) {
  const key = loginBucketKey(email);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + WINDOW_MS);
  const rows = await prisma.$queryRaw<{ attempts: number }[]>`
    INSERT INTO login_buckets (key, attempts, "expiresAt") VALUES (${key}, 1, ${expiresAt})
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE WHEN login_buckets."expiresAt" <= ${now} THEN 1 ELSE login_buckets.attempts + 1 END,
      "expiresAt" = CASE WHEN login_buckets."expiresAt" <= ${now} THEN ${expiresAt} ELSE login_buckets."expiresAt" END
    WHERE login_buckets."expiresAt" <= ${now} OR login_buckets.attempts < ${MAX_LOGIN_ATTEMPTS}
    RETURNING attempts`;
  // Index-backed cleanup avoids retaining identifiers indefinitely. Keys are HMACs,
  // not raw emails. A hosting-level source-IP limit is still needed for spraying.
  await prisma.loginBucket.deleteMany({ where: { expiresAt: { lte: now } } });
  return rows.length > 0;
}

export async function clearLoginAttempts(email: string) {
  await prisma.loginBucket.deleteMany({ where: { key: loginBucketKey(email) } });
}
