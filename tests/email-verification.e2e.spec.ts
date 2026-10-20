import { test, expect, request as apiRequest, type APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { loginWithEmail, readEmailCode } from "./helpers/auth";

const prisma = new PrismaClient(), users: string[] = [], emails: string[] = [];
const password = "Temporary verification passphrase!";
async function admin(api: APIRequestContext) {
  const email = `${randomUUID()}@example.invalid`;
  const response = await api.post("/api/users", { data: { name: "Email verification test", email, password, role: "ADMIN" } });
  expect(response.status()).toBe(201); const user = await response.json(); users.push(user.id); emails.push(email); return { ...user, email };
}
async function issue(api: APIRequestContext, email: string) { return api.post("/api/auth/email-challenge", { data: { email, password } }); }
async function complete(api: APIRequestContext, email: string, challengeId = "", code = "", secret = password) {
  const csrf = await (await api.get("/api/auth/csrf")).json();
  return api.post("/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email, password: secret, challengeId, code, json: "true", callbackUrl: "/dashboard" } });
}
test.beforeEach(async ({ request, baseURL }) => {
  if (!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) throw new Error("Local test instance required");
  await loginWithEmail(request); expect((await (await request.get("/api/auth/session")).json()).user.role).toBe("ADMIN");
});
test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  const keys = emails.flatMap((email) => [email, `email-send:${email}`].map((value) => createHmac("sha256", process.env.NEXTAUTH_SECRET!).update(`login:${value}`).digest("hex")));
  await prisma.loginBucket.deleteMany({ where: { key: { in: keys } } }); await prisma.$disconnect();
});

test("administrators need a bound email code; codes are hashed, single-use and concurrent-safe", async ({ request, baseURL }) => {
  const a = await admin(request), b = await admin(request);
  const first = await apiRequest.newContext({ baseURL }), second = await apiRequest.newContext({ baseURL });
  try {
    expect((await complete(first, a.email)).status()).toBe(401);
    const response = await issue(first, a.email); expect(response.status()).toBe(200);
    const challenge = await response.json(), code = await readEmailCode(challenge.challengeId);
    expect(challenge.code).toBeUndefined(); expect(challenge.codeHash).toBeUndefined();
    const saved = await prisma.emailLoginChallenge.findUniqueOrThrow({ where: { userId: a.id } });
    expect(saved.codeHash).not.toBe(code); expect(saved.codeHash).toHaveLength(64);
    expect((await complete(second, b.email, challenge.challengeId, code)).status()).toBe(401);
    const results = await Promise.all([complete(first, a.email, challenge.challengeId, code), complete(second, a.email, challenge.challengeId, code)]);
    expect(results.map((r) => r.status()).sort()).toEqual([200, 401]);
    expect(await prisma.emailLoginChallenge.findUnique({ where: { userId: a.id } })).toBeNull();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: a.id } })).emailVerifiedAt).not.toBeNull();
    expect((await complete(first, a.email, challenge.challengeId, code)).status()).toBe(401);
  } finally { await first.dispose(); await second.dispose(); }
});

test("resend cooldown and five wrong codes protect a challenge", async ({ request, baseURL }) => {
  const user = await admin(request), client = await apiRequest.newContext({ baseURL });
  try {
    const challenge = await (await issue(client, user.email)).json();
    expect((await issue(client, user.email)).status()).toBe(429);
    const code = await readEmailCode(challenge.challengeId), wrong = code === "000000" ? "000001" : "000000";
    for (let i = 0; i < 5; i++) expect((await complete(client, user.email, challenge.challengeId, wrong)).status()).toBe(401);
    expect((await complete(client, user.email, challenge.challengeId, code)).status()).toBe(401);
    expect((await prisma.emailLoginChallenge.findUniqueOrThrow({ where: { userId: user.id } })).attempts).toBe(5);
  } finally { await client.dispose(); }
});

test("expiry, replacement and password reset invalidate old email codes", async ({ request, baseURL }) => {
  const user = await admin(request), client = await apiRequest.newContext({ baseURL });
  try {
    const first = await (await issue(client, user.email)).json(), firstCode = await readEmailCode(first.challengeId);
    await prisma.emailLoginChallenge.update({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() - 1), createdAt: new Date(Date.now() - 61000) } });
    expect((await complete(client, user.email, first.challengeId, firstCode)).status()).toBe(401);
    const second = await (await issue(client, user.email)).json(), secondCode = await readEmailCode(second.challengeId);
    expect(second.challengeId).not.toBe(first.challengeId);
    expect((await complete(client, user.email, first.challengeId, firstCode)).status()).toBe(401);
    const replacement = "Replacement verification passphrase!";
    expect((await request.patch(`/api/users/${user.id}`, { data: { password: replacement } })).status()).toBe(200);
    expect((await complete(client, user.email, second.challengeId, secondCode, replacement)).status()).toBe(401);
  } finally { await client.dispose(); }
});

test("delivery failure grants no challenge, send quotas apply, and demo retirement needs a real verified admin", async ({ request, baseURL }) => {
  const user = await admin(request), client = await apiRequest.newContext({ baseURL });
  const failure = path.resolve(".local/test-email-outbox", `fail-${createHash("sha256").update(user.email).digest("hex")}`);
  try {
    await writeFile(failure, "fail", { mode: 0o600 });
    expect((await issue(client, user.email)).status()).toBe(503);
    expect(await prisma.emailLoginChallenge.findUnique({ where: { userId: user.id } })).toBeNull();
    await unlink(failure);
    // Failed delivery consumes a send allowance too: four more sends reach five.
    for (let i = 0; i < 4; i++) {
      const issued = await issue(client, user.email); expect(issued.status()).toBe(200);
      const challenge = await issued.json();
      expect((await complete(client, user.email, challenge.challengeId, await readEmailCode(challenge.challengeId))).status()).toBe(200);
    }
    expect((await issue(client, user.email)).status()).toBe(429);
    const before = await prisma.user.count({ where: { isActive: true } });
    expect((await request.post("/api/users/retire-demo", { data: { confirm: true, preview: true } })).status()).toBe(409);
    const preview = await client.post("/api/users/retire-demo", { data: { confirm: true, preview: true } });
    expect(preview.status()).toBe(200); expect((await preview.json()).wouldDeactivate).toBe(5);
    expect(await prisma.user.count({ where: { isActive: true } })).toBe(before);
  } finally { await unlink(failure).catch(() => {}); await client.dispose(); }
});

test("a pending administrator can set a private password and retry activation after a connection failure", async ({ request, page, baseURL }) => {
  const user = await admin(request);
  expect((await request.patch(`/api/users/${user.id}`, { data: { isActive: false } })).status()).toBe(200);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto("/admin/users");
  const account = page.getByRole("group", { name: `Account Email verification test ${user.email}`, exact: true });
  await account.getByRole("button", { name: "Set password and activate", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Set password and activate" });
  const replacement = "Private activation test passphrase!";
  await dialog.getByPlaceholder("Passphrase: at least 15 characters").fill(replacement);
  await page.route(`**/api/users/${user.id}`, (route) => route.abort("failed"));
  await dialog.getByRole("button", { name: "Set password and activate", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Could not connect");
  await expect(dialog.getByRole("button", { name: "Set password and activate", exact: true })).toBeEnabled();
  expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).isActive).toBe(false);
  await page.unroute(`**/api/users/${user.id}`);
  await dialog.getByRole("button", { name: "Set password and activate", exact: true }).click();
  await expect(dialog.getByText("Account activated", { exact: false })).toBeVisible();
  const client = await apiRequest.newContext({ baseURL });
  try {
    expect((await loginWithEmail(client, user.email, replacement)).status()).toBe(200);
    expect((await (await client.get("/api/auth/session")).json()).user.adminEmailVerified).toBe(true);
  } finally { await client.dispose(); }
  expect(await prisma.user.count({ where: { email: { in: ["admin@sjss.com", ...[1, 2, 3, 4].map((n) => `user${n}@sjss.com`)] }, isActive: true } })).toBe(5);
});
