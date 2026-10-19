import type { APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
process.loadEnvFile(".env");

export async function readEmailCode(challengeId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(challengeId)) throw new Error("Invalid test challenge ID");
  const data = JSON.parse(await readFile(path.join(process.cwd(), ".local/test-email-outbox", `${challengeId}.json`), "utf8"));
  const code = data.text.match(/code is: (\d{6})/)?.[1];
  if (!code) throw new Error("No code in the local mock-email outbox. Start the app using npm run test:server.");
  return code as string;
}

export async function loginWithEmail(api: APIRequestContext, email = process.env.CRM_TEST_EMAIL || "admin@sjss.com", password = process.env.CRM_TEST_PASSWORD || "admin123") {
  // Many independent workflow tests share a fixture administrator. Reset only
  // that fixture's mail-send quota; security tests exercise quotas separately.
  const prisma = new PrismaClient();
  try {
    const key = createHmac("sha256", process.env.NEXTAUTH_SECRET!).update(`login:email-send:${email.trim().toLowerCase()}`).digest("hex");
    await prisma.loginBucket.deleteMany({ where: { key } });
  } finally { await prisma.$disconnect(); }
  const response = await api.post("/api/auth/email-challenge", { data: { email, password } });
  if (!response.ok()) return response;
  const challenge = await response.json();
  const code = challenge.step === "code" ? await readEmailCode(challenge.challengeId) : "";
  const csrf = await (await api.get("/api/auth/csrf")).json();
  return api.post("/api/auth/callback/credentials", { form: {
    csrfToken: csrf.csrfToken, email, password, code, challengeId: challenge.challengeId || "", callbackUrl: "/dashboard", json: "true",
  } });
}
