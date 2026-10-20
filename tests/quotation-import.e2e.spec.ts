import { loginWithEmail } from "./helpers/auth";
import { test, expect, request as apiRequest } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { removeUnreferencedFile } from "../lib/file-storage";

const prisma = new PrismaClient();
const tag = `Import check ${randomUUID().slice(0, 8)}`;
const xlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
let companyId: string, userId: string;
let workbook: Buffer;
const source = path.join(process.cwd(), "tests/fixtures/legacy-quotation.xlsx");
test.beforeEach(async ({ request, page, baseURL }) => {
  if (!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) throw new Error("Local test instance required");
  await loginWithEmail(request);
  userId = (await (await request.get("/api/auth/session")).json()).user.id;
  expect(userId).toBeTruthy();
  companyId = (await (await request.get("/api/companies")).json())[0].id;
  await page.context().addCookies((await request.storageState()).cookies);
  workbook = await readFile(source);
});
test.afterAll(async () => {
  const where = { customer: { name: { startsWith: tag } } };
  const attachments = await prisma.attachment.findMany({ where: { quotation: where } });
  await prisma.quotation.deleteMany({ where });
  await prisma.customer.deleteMany({ where: { name: { startsWith: tag } } });
  for (const file of attachments) await removeUnreferencedFile(file.filepath);
  await prisma.$disconnect();
});

test("invalid import metadata and files leave no customer or quotation behind", async ({ request, baseURL }) => {
  const row = { companyId, companyName: `${tag} Invalid`, quotationNumber: `${tag}-invalid`, amount: "100.00" };
  const invalidRows: Record<string, string>[] = [
    { amount: "123abc" }, { amount: "Infinity" }, { amount: "-1" }, { amount: "0.001" }, { amount: "10000000000" },
    { date: "2026-02-31" }, { date: "not-a-date" }, { status: "PAID" }, { companyName: "   " },
  ];
  for (const changes of invalidRows)
    expect((await request.post("/api/quotations/upload", { multipart: { ...row, ...changes } })).status()).toBe(400);
  expect((await request.post("/api/quotations/upload", { multipart: { ...row, file: "not a file" } })).status()).toBe(400);
  expect((await request.post("/api/quotations/upload", { multipart: { ...row, file: { name: "empty.xlsx", mimeType: xlsx, buffer: Buffer.alloc(0) } } })).status()).toBe(400);
  const badFile = { name: "bad.pdf", mimeType: "application/pdf", buffer: Buffer.from("This is not a PDF") };
  expect((await request.post("/api/quotations/upload", { multipart: { ...row, file: badFile } })).status()).toBe(400);
  expect((await request.post("/api/quotations/extract", { multipart: { file: badFile } })).status()).toBe(400);
  expect((await request.post("/api/quotations/extract", { multipart: { file: "not a file" } })).status()).toBe(400);
  expect((await request.post("/api/quotations/import", { data: "{", headers: { "Content-Type": "application/json" } })).status()).toBe(400);
  expect((await request.post("/api/quotations/import", { data: [{ ...row, amount: 1.001 }] })).status()).toBe(400);
  expect(await prisma.customer.count({ where: { name: { startsWith: `${tag} Invalid` } } })).toBe(0);
  expect(await prisma.quotation.count({ where: { quotationNumber: `${tag}-invalid` } })).toBe(0);
  const anonymous = await apiRequest.newContext({ baseURL });
  try {
    expect((await anonymous.post("/api/quotations/upload", { multipart: row })).status()).toBe(401);
    expect((await anonymous.post("/api/quotations/import", { data: [] })).status()).toBe(401);
  } finally { await anonymous.dispose(); }
});

test("concurrent duplicate references roll back losing records and preserve the original workbook", async ({ request }) => {
  const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), ".local/uploads");
  const before = await readdir(uploadDir);
  const quotationNumber = `${tag}-concurrent`;
  const responses = await Promise.all(["First", "Second"].map((name) => request.post("/api/quotations/upload", { multipart: {
    companyId, companyName: `${tag} ${name}`, quotationNumber, amount: "1234.56", date: "2020-02-29",
    file: { name: "Father-style quotation.xlsx", mimeType: xlsx, buffer: workbook },
  } })));
  expect(responses.map((r) => r.status()).sort()).toEqual([201, 409]);
  const created = await responses.find((r) => r.status() === 201)!.json();
  const quote = await prisma.quotation.findUniqueOrThrow({ where: { id: created.id }, include: { attachments: true, items: true, customer: true } });
  expect(quote.status).toBe("DRAFT");
  expect(quote.totalAmount.toString()).toBe("1234.56");
  expect(quote.items[0].total.toString()).toBe("1234.56");
  expect(quote.customer.companyId).toBe(companyId);
  expect(quote.createdAt.toISOString()).toBe("2020-02-28T16:00:00.000Z");
  expect(quote.createdById).toBe(userId);
  expect(quote.attachments).toHaveLength(1);
  const file = await request.get(`/api/uploads/${quote.attachments[0].id}/file`);
  expect(file.status()).toBe(200); expect(await file.body()).toEqual(workbook);
  expect(quote.attachments[0].filename).toBe("Father-style quotation.xlsx");
  expect(await prisma.customer.count({ where: { name: { in: [`${tag} First`, `${tag} Second`] } } })).toBe(1);
  const addedFiles = (await readdir(uploadDir)).filter((name) => !before.includes(name));
  expect(addedFiles).toEqual([quote.attachments[0].filepath]);
  const otherCompany = (await (await request.get("/api/companies")).json())[1].id;
  const result = await (await request.post("/api/quotations/import", { data: [
    { companyId, companyName: `${tag} Duplicate customer`, quotationNumber, amount: 1 },
    { companyId: "nonexistent-company", companyName: `${tag} Missing company`, amount: 2 },
    { companyId: otherCompany, companyName: `${tag} Batch valid`, quotationNumber: `${tag}-batch`, amount: 10.25, status: "ACCEPTED" },
  ] })).json();
  expect(result.imported).toBe(1); expect(result.errors.map((e: { index: number }) => e.index)).toEqual([1, 2]);
  expect(await prisma.customer.count({ where: { name: { in: [`${tag} Duplicate customer`, `${tag} Missing company`] } } })).toBe(0);
  const batch = await prisma.quotation.findUniqueOrThrow({ where: { quotationNumber: `${tag}-batch` } });
  expect(batch.companyId).toBe(otherCompany); expect(batch.status).toBe("ACCEPTED");
});

test("removing an extracting document unlocks the form and stale suggestions cannot overwrite its replacement", async ({ page }) => {
  let finish!: () => void;
  let completed!: () => void;
  let started!: () => void;
  const requestStarted = new Promise<void>((resolve) => { started = resolve; });
  const responseReady = new Promise<void>((resolve) => { finish = resolve; });
  const responseDone = new Promise<void>((resolve) => { completed = resolve; });
  await page.route("**/api/quotations/extract", async (route) => {
    started();
    await responseReady;
    try { await route.fulfill({ json: { companyName: "Wrong old customer", amount: 999, quotationNumber: "OLD" } }); }
    catch { /* The cancelled request may already have closed. */ }
    finally { completed(); }
  });
  await page.goto("/quotations/import");
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue("DRAFT");
  await page.locator('input[type="file"]').setInputFiles({ name: "old.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") });
  await requestStarted;
  await expect(page.getByRole("button", { name: "Save Quotation", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Remove selected document" }).click();
  await expect(page.getByRole("button", { name: "Save Quotation", exact: true })).toBeEnabled();
  await page.locator('input[type="file"]').setInputFiles(source);
  await page.getByLabel("Company", { exact: true }).selectOption(companyId);
  await page.getByLabel("Company / Customer Name", { exact: false }).fill(`${tag} UI customer`);
  await page.getByLabel("Quotation Number", { exact: false }).fill(`${tag}-ui`);
  await page.getByLabel("Amount (RM)", { exact: false }).fill("1234.56");
  finish(); await responseDone;
  await expect(page.getByLabel("Company / Customer Name", { exact: false })).toHaveValue(`${tag} UI customer`);
  await expect(page.getByLabel("Amount (RM)", { exact: false })).toHaveValue("1234.56");
  await page.getByRole("button", { name: "Save Quotation", exact: true }).click();
  await page.waitForURL((url) => /^\/quotations\/[^/]+$/.test(url.pathname) && url.pathname !== "/quotations/import");
  const quote = await prisma.quotation.findUniqueOrThrow({ where: { quotationNumber: `${tag}-ui` }, include: { attachments: true } });
  expect(quote.status).toBe("DRAFT"); expect(quote.attachments).toHaveLength(1);
  expect(await (await page.request.get(`/api/uploads/${quote.attachments[0].id}/file`)).body()).toEqual(workbook);
});
