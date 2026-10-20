import { loginWithEmail, readEmailCode } from "./helpers/auth";
import { test, expect, request as apiRequest, type APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID, createHmac } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";

process.loadEnvFile(".env");
const prisma = new PrismaClient();
const prefix = `Security ${randomUUID()}`;
const password = "Temporary secure test passphrase!";
const users: string[] = [], customers: string[] = [], quotes: string[] = [], buckets: string[] = [], companyIds: string[] = [];
async function login(api: APIRequestContext, email = process.env.CRM_TEST_EMAIL || "admin@sjss.com", secret = process.env.CRM_TEST_PASSWORD || "admin123") {
  return loginWithEmail(api, email, secret);
}
async function employee(api: APIRequestContext) {
  const email = `${randomUUID()}@example.invalid`;
  const response = await api.post("/api/users", { data: { email, name: prefix, password, role: "USER" } });
  expect(response.status()).toBe(201);
  const user = await response.json(); users.push(user.id); return { ...user, email };
}
async function customer(api: APIRequestContext) {
  const company = await prisma.company.create({ data: { name: prefix, prefix: `SEC${randomUUID().slice(0, 6)}` } });
  companyIds.push(company.id);
  const response = await api.post("/api/customers", { data: { name: prefix, companyId: company.id } });
  expect(response.status()).toBe(201);
  const record = await response.json(); customers.push(record.id); return record;
}
test.beforeEach(async ({ request, baseURL }) => {
  if (!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) throw new Error("Local test instance required");
  await login(request);
  expect((await (await request.get("/api/auth/session")).json()).user.role).toBe("ADMIN");
});
test.afterAll(async () => {
  await prisma.quotation.deleteMany({ where: { id: { in: quotes } } });
  await prisma.customer.deleteMany({ where: { id: { in: customers } } });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.loginBucket.deleteMany({ where: { key: { in: buckets } } });
  await prisma.$disconnect();
});

test("every business API rejects anonymous requests and public signup is unavailable", async ({ baseURL }) => {
  const guest = await apiRequest.newContext({ baseURL });
  async function routes(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    return (await Promise.all(entries.map((entry) => entry.isDirectory() ? routes(`${dir}/${entry.name}`) : entry.name === "route.ts" ? [`${dir}/${entry.name}`] : []))).flat();
  }
  try {
    for (const file of await routes("app/api")) {
      if (file.includes("/auth/") || file.includes("/uploads/blocked/")) continue;
      const path = file.replace("app", "").replace("/route.ts", "").replaceAll(/\[[^\]]+\]/g, "missing-security-record");
      const source = await readFile(file, "utf8");
      for (const match of source.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\(/g)) {
        const method = match[1].toLowerCase() as "get" | "post" | "put" | "patch" | "delete";
        const response = await guest[method](path);
        expect(response.status(), `${match[1]} ${path}`).toBe(401);
      }
    }
    for (const path of ["/signup", "/register", "/api/signup", "/api/register"]) expect((await guest.get(path)).status()).toBe(404);
    const csrf = await (await guest.get("/api/auth/csrf")).json();
    expect(csrf.csrfToken).toBeTruthy();
    await guest.post("/api/auth/callback/credentials", { form: { email: process.env.CRM_TEST_EMAIL || "admin@sjss.com", password: process.env.CRM_TEST_PASSWORD || "admin123", json: "true" } });
    expect((await (await guest.get("/api/auth/session")).json()).user).toBeUndefined();
  } finally { await guest.dispose(); }
});

test("strong password rules, staff administration denial and lasting session revocation", async ({ request, baseURL }) => {
  for (const weak of ["short123", "🛠".repeat(20)]) {
    expect((await request.post("/api/users", { data: { name: prefix, email: `${randomUUID()}@example.invalid`, password: weak } })).status()).toBe(400);
  }
  const user = await employee(request);
  expect(user.passwordHash).toBeUndefined();
  const staff = await apiRequest.newContext({ baseURL });
  let replay: APIRequestContext | undefined;
  try {
    await login(staff, user.email, password);
    const state = await staff.storageState();
    expect((await staff.get("/api/users")).status()).toBe(403);
    expect((await staff.post("/api/users", { data: {} })).status()).toBe(403);
    expect((await staff.patch(`/api/users/${user.id}`, { data: { role: "ADMIN" } })).status()).toBe(403);
    expect((await staff.get("/api/reports/pdf")).status()).toBe(403);
    expect((await staff.post("/api/notifications", { data: {} })).status()).toBe(403);
    await request.patch(`/api/users/${user.id}`, { data: { isActive: false } });
    expect((await staff.get("/api/customers")).status()).toBe(401);
    await request.patch(`/api/users/${user.id}`, { data: { isActive: true } });
    replay = await apiRequest.newContext({ baseURL, storageState: state });
    expect((await replay.get("/api/customers")).status()).toBe(401);
    await login(staff, user.email, password);
    expect((await staff.get("/api/customers")).status()).toBe(200);
  } finally { await staff.dispose(); await replay?.dispose(); }
});

test("cross-origin mutations, malformed JSON, large bodies and hostile pagination fail safely", async ({ request, baseURL }) => {
  const companies = await (await request.get("/api/companies")).json();
  const before = await prisma.customer.count();
  const hostileHeaders: Record<string, string>[] = [
    { origin: "https://attacker.example" },
    { origin: "null" },
    { "sec-fetch-site": "same-site", origin: "http://sibling.localhost:3000" },
    { "sec-fetch-site": "cross-site" },
  ];
  for (const headers of hostileHeaders) {
    expect((await request.post("/api/customers", { headers, data: { name: prefix, companyId: companies[0].id } })).status()).toBe(403);
  }
  expect(await prisma.customer.count()).toBe(before);
  expect((await request.post("/api/customers", { headers: { origin: new URL(baseURL!).origin, "Content-Type": "application/json" }, data: "{" })).status()).toBe(400);
  expect((await request.post("/api/customers", { data: { name: "x".repeat(1024 * 1024 + 1), companyId: companies[0].id } })).status()).toBe(413);
  for (const path of ["/api/customers", "/api/quotations", "/api/site-visits", "/api/notifications"]) {
    const response = await request.get(`${path}?page=Infinity&limit=-999999&status=INVALID`);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
});

test("simultaneous administrator removals cannot use a revoked administrator to remove the survivor", async ({ request, baseURL }) => {
  const first = await employee(request), second = await employee(request);
  await request.patch(`/api/users/${first.id}`, { data: { role: "ADMIN" } });
  await request.patch(`/api/users/${second.id}`, { data: { role: "ADMIN" } });
  const a = await apiRequest.newContext({ baseURL }), b = await apiRequest.newContext({ baseURL });
  try {
    await login(a, first.email, password); await login(b, second.email, password);
    const results = await Promise.all([
      a.patch(`/api/users/${second.id}`, { data: { isActive: false } }),
      b.patch(`/api/users/${first.id}`, { data: { isActive: false } }),
    ]);
    expect(results.filter((r) => r.status() === 200)).toHaveLength(1);
    expect(results.every((r) => [200, 401, 403].includes(r.status()))).toBeTruthy();
    expect(await prisma.user.count({ where: { id: { in: [first.id, second.id] }, isActive: true, role: "ADMIN" } })).toBe(1);
  } finally { await a.dispose(); await b.dispose(); }
});

test("persistent login throttling blocks repeated guesses and expires correctly", async ({ request, baseURL }) => {
  const user = await employee(request);
  const key = createHmac("sha256", process.env.NEXTAUTH_SECRET!).update(`login:${user.email}`).digest("hex");
  buckets.push(key);
  const client = await apiRequest.newContext({ baseURL });
  try {
    for (let i = 0; i < 10; i++) await login(client, user.email.toUpperCase(), "incorrect password");
    await login(client, user.email, password);
    expect((await (await client.get("/api/auth/session")).json()).user).toBeUndefined();
    expect((await prisma.loginBucket.findUniqueOrThrow({ where: { key } })).attempts).toBe(10);
    await prisma.loginBucket.update({ where: { key }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await login(client, user.email, password);
    expect((await (await client.get("/api/auth/session")).json()).user.id).toBe(user.id);
    expect(await prisma.loginBucket.findUnique({ where: { key } })).toBeNull();
  } finally { await client.dispose(); }
});

test("quotation bounds, exact totals, ownership and concurrent invoice numbers are enforced", async ({ request, baseURL }) => {
  const record = await customer(request);
  const data = { customerId: record.id, companyId: record.companyId, items: [{ description: "Fractional work", quantity: 0.1, unitPrice: 0.05 }] };
  for (const invalid of [{ ...data, validUntil: "2026-02-30" }, { ...data, items: [] }, { ...data, items: [{ description: "Too large", quantity: 100000000, unitPrice: 100000000 }] }])
    expect((await request.post("/api/quotations", { data: invalid })).status()).toBe(400);
  const created = [];
  for (let i = 0; i < 2; i++) {
    const response = await request.post("/api/quotations", { data }); expect(response.status()).toBe(201);
    const quote = await response.json(); quotes.push(quote.id); created.push(quote);
    expect(Number(quote.totalAmount)).toBe(0.01); expect(Number(quote.items[0].total)).toBe(0.01);
    expect((await request.put(`/api/quotations/${quote.id}`, { data: { status: "ACCEPTED" } })).status()).toBe(200);
  }
  const user = await employee(request), staff = await apiRequest.newContext({ baseURL });
  const company = await prisma.company.findUniqueOrThrow({ where: { id: record.companyId } });
  const year = Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Kuala_Lumpur", year: "numeric" }).format(new Date()));
  await prisma.quotation.update({ where: { id: created[0].id }, data: { quotationNumber: `${company.prefix}-${year}-0050` } });
  const next = await request.post("/api/quotations", { data }); expect(next.status()).toBe(201);
  const historicalSuccessor = await next.json(); quotes.push(historicalSuccessor.id);
  expect(historicalSuccessor.quotationNumber).toBe(`${company.prefix}-${year}-0051`);
  try {
    await login(staff, user.email, password);
    expect((await staff.put(`/api/quotations/${created[0].id}`, { data: { notes: "Tamper" } })).status()).toBe(403);
    expect((await staff.post(`/api/quotations/${created[0].id}/invoice`)).status()).toBe(403);
    const results = await Promise.all([created[0], created[1], created[0]].map((quote) => request.post(`/api/quotations/${quote.id}/invoice`)));
    results.forEach((response) => expect(response.status()).toBe(200));
    const values = await Promise.all(results.map((response) => response.json()));
    expect(values[0].invoiceNumber).not.toBe(values[1].invoiceNumber);
    expect(values[0].invoiceNumber).toBe(values[2].invoiceNumber);
  } finally { await staff.dispose(); }
});

test("security headers and nonce CSP allow the login form while blocking injected scripts", async ({ page, context }) => {
  await context.clearCookies();
  // Inject into the untrusted HTML response. DevTools evaluate-created scripts
  // run with automation privileges and don't represent a parser-inserted attack.
  await page.route("**/login", async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace("</head>", "<script>window.__injected = true</script></head>");
    await route.fulfill({ response, body });
  });
  const response = await page.goto("/login");
  const headers = response!.headers();
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toMatch(/script-src .*'nonce-[^']+'/);
  expect(headers["content-security-policy"]).not.toContain("'unsafe-eval'");
  expect(headers["x-powered-by"]).toBeUndefined();
  expect(await page.evaluate(() => (window as Window & { __injected?: boolean }).__injected)).toBeUndefined();
  await page.getByPlaceholder("you@company.com").fill(process.env.CRM_TEST_EMAIL || "admin@sjss.com");
  await page.locator('input[type="password"]').fill(process.env.CRM_TEST_PASSWORD || "admin123");
  const challengeResponse = page.waitForResponse((response) => response.url().endsWith("/api/auth/email-challenge"));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const challenge = await (await challengeResponse).json();
  await page.getByLabel("Email verification code", { exact: true }).fill(await readEmailCode(challenge.challengeId));
  await page.getByRole("button", { name: "Verify and sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
