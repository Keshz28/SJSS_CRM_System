import { loginWithEmail } from "./helpers/auth";
import { test, expect, request as apiRequest, type APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { removeUnreferencedFile } from "../lib/file-storage";
const prisma = new PrismaClient();
const ids: string[] = [], users: string[] = [], customers: string[] = [];
const prefix = `Organise ${randomUUID().slice(0, 8)}`;
let companies: { id: string; name: string }[];
let adminId: string;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA6sAAAAASUVORK5CYII=", "base64");
async function login(api: APIRequestContext, email = process.env.CRM_TEST_EMAIL || "admin@sjss.com", password = process.env.CRM_TEST_PASSWORD || "admin123") {
  await loginWithEmail(api, email, password);
  return (await (await api.get("/api/auth/session")).json()).user;
}
async function createProject(api: APIRequestContext, name: string, companyId = companies[0].id) {
  const response = await api.post("/api/projects", { data: { name: `${prefix} ${name}`, companyId } });
  expect(response.status()).toBe(201); const p = await response.json(); ids.push(p.id); return p;
}
async function staff(baseURL: string, admin: APIRequestContext) {
  const password = `Temporary-${randomUUID()}`;
  const email = `${randomUUID()}@example.invalid`;
  const response = await admin.post("/api/users", { data: { name: "Temporary organiser", email, password, role: "USER" } });
  expect(response.status()).toBe(201); const user = await response.json(); users.push(user.id);
  const api = await apiRequest.newContext({ baseURL }); await login(api, email, password); return api;
}
test.beforeEach(async ({ request, page, baseURL }) => {
  if (!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) throw new Error("Local test instance required");
  adminId = (await login(request)).id;
  await page.context().addCookies((await request.storageState()).cookies);
  companies = await (await request.get("/api/companies")).json();
});
test.afterAll(async () => {
  const attachments = await prisma.attachment.findMany({ where: { OR: [{ siteVisit: { projectId: { in: ids } } }, { quotation: { projectId: { in: ids } } }] } });
  await prisma.siteVisit.deleteMany({ where: { projectId: { in: ids } } });
  await prisma.quotation.deleteMany({ where: { projectId: { in: ids } } });
  await prisma.project.deleteMany({ where: { id: { in: ids } } });
  await prisma.customer.deleteMany({ where: { id: { in: customers } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  for (const a of attachments) await removeUnreferencedFile(a.filepath);
  await prisma.$disconnect();
});

test("pins and stars persist per user, sort before pagination, and respect company and literal searches", async ({ page, request, baseURL }) => {
  const a = await createProject(request, "Old pin");
  const b = await createProject(request, "Old star");
  await prisma.project.updateMany({ where: { id: { in: [a.id, b.id] } }, data: { updatedAt: new Date("2025-01-01T00:00:00Z") } });
  const filler = Array.from({ length: 22 }, (_, i) => ({ id: randomUUID(), name: `${prefix} Newer ${i}`, companyId: companies[0].id, createdById: adminId }));
  await prisma.project.createMany({ data: filler }); ids.push(...filler.map((p) => p.id));
  const search = encodeURIComponent(prefix);
  await page.goto(`/projects?search=${search}&page=2`);
  await page.getByRole("button", { name: `Pin ${a.name}`, exact: true }).click();
  await expect.poll(async () => (await prisma.projectPreference.findUnique({ where: { userId_projectId: { userId: adminId, projectId: a.id } } }))?.isPinned).toBe(true);
  await page.getByRole("button", { name: `Star ${b.name}`, exact: true }).click();
  await expect.poll(async () => (await prisma.projectPreference.findUnique({ where: { userId_projectId: { userId: adminId, projectId: b.id } } }))?.isStarred).toBe(true);
  await page.goto(`/projects?search=${search}`);
  await expect(page.getByRole("article").nth(0)).toHaveAttribute("aria-label", a.name);
  await expect(page.getByRole("article").nth(1)).toHaveAttribute("aria-label", b.name);
  await expect(page.getByRole("button", { name: `Unpin ${a.name}`, exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByRole("button", { name: `Unstar ${b.name}`, exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("combobox", { name: "Project stage", exact: true }).selectOption("PLANNED");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const sections = page.getByRole("navigation", { name: "Project sections" });
  await sections.getByRole("link", { name: "Pinned", exact: true }).click();
  await expect(sections.getByRole("link", { name: "Pinned", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Pinned", exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("search")).toBe(prefix);
  expect(new URL(page.url()).searchParams.get("status")).toBe("PLANNED");
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article")).toHaveAttribute("aria-label", a.name);
  await sections.getByRole("link", { name: "Starred", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article")).toHaveAttribute("aria-label", b.name);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(sections.getByRole("link", { name: "Starred", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("article")).toHaveAttribute("aria-label", b.name);
  const list = await (await request.get(`/api/projects?search=${search}`)).json();
  expect(list.slice(0, 2).map((p: { id: string }) => p.id)).toEqual([a.id, b.id]);
  const other = await staff(baseURL!, request);
  try {
    const ownList = await (await other.get(`/api/projects?search=${search}`)).json();
    expect(ownList.every((p: { isPinned: boolean; isStarred: boolean }) => !p.isPinned && !p.isStarred)).toBeTruthy();
    expect((await other.patch(`/api/projects/${a.id}/preferences`, { data: { isStarred: true } })).status()).toBe(200);
    expect((await other.delete(`/api/projects/${a.id}`)).status()).toBe(403);
    expect((await other.post(`/api/projects/${a.id}/restore`)).status()).toBe(403);
    expect((await other.patch(`/api/projects/${a.id}/preferences`, { data: { isPinned: true, userId: adminId } })).status()).toBe(400);
    const own = await (await request.get(`/api/projects?search=${search}&view=starred`)).json();
    expect(own.map((p: { id: string }) => p.id)).toEqual([b.id]);
  } finally { await other.dispose(); }
  const co = await createProject(request, "Other company", companies[1].id);
  await request.patch(`/api/projects/${co.id}/preferences`, { data: { isPinned: true } });
  const scoped = await (await request.get(`/api/projects?company=${companies[1].id}&view=pinned&search=${search}`)).json();
  expect(scoped.map((p: { id: string }) => p.id)).toEqual([co.id]);
  const literal = await createProject(request, "100%_O'Brien");
  const matches = await (await request.get(`/api/projects?search=${encodeURIComponent(`${prefix} 100%_O'`)}`)).json();
  expect(matches.map((p: { id: string }) => p.id)).toEqual([literal.id]);
  const anon = await apiRequest.newContext({ baseURL });
  try {
    expect((await anon.patch(`/api/projects/${a.id}/preferences`, { data: { isPinned: true } })).status()).toBe(401);
    expect((await anon.delete(`/api/projects/${a.id}`)).status()).toBe(401);
    expect((await anon.post(`/api/projects/${a.id}/restore`)).status()).toBe(401);
  }
  finally { await anon.dispose(); }
});

test("delete and restore retain site media and quotations while preventing work on deleted projects", async ({ request, baseURL }) => {
  const owner = await staff(baseURL!, request);
  try {
    const p = await createProject(owner, "Retained history");
    const key = randomUUID();
    const v = await (await owner.post("/api/site-visits", { data: { projectId: p.id, companyId: p.companyId, title: p.name, clientRequestId: key } })).json();
    const upload = { multipart: { siteVisitId: v.id, file: { name: "evidence.png", mimeType: "image/png", buffer: png } } };
    const attachment = await (await owner.post("/api/uploads", upload)).json();
    const converted = await (await owner.post(`/api/site-visits/${v.id}/convert`)).json();
    const q = await prisma.quotation.findUniqueOrThrow({ where: { id: converted.quotationId } }); customers.push(q.customerId);
    await owner.patch(`/api/projects/${p.id}/preferences`, { data: { isPinned: true, isStarred: true } });
    expect((await owner.delete(`/api/projects/${p.id}`)).status()).toBe(200);
    const deleted = await prisma.project.findUniqueOrThrow({ where: { id: p.id } }); expect(deleted.deletedAt).not.toBeNull();
    await owner.delete(`/api/projects/${p.id}`);
    expect((await prisma.project.findUniqueOrThrow({ where: { id: p.id } })).deletedAt).toEqual(deleted.deletedAt);
    expect((await (await owner.get(`/api/projects?search=${encodeURIComponent(p.name)}`)).json())).toHaveLength(0);
    expect((await (await owner.get(`/api/projects?view=deleted&search=${encodeURIComponent(p.name)}`)).json())[0].id).toBe(p.id);
    expect((await (await owner.get(`/api/site-visits?search=${encodeURIComponent(p.name)}`)).json()).total).toBe(0);
    expect((await owner.get(`/api/site-visits/${v.id}`)).status()).toBe(404);
    expect((await owner.patch(`/api/projects/${p.id}`, { data: { name: "Changed" } })).status()).toBe(404);
    expect((await owner.patch(`/api/projects/${p.id}/preferences`, { data: { isPinned: false } })).status()).toBe(404);
    expect((await owner.post("/api/site-visits", { data: { projectId: p.id, companyId: p.companyId, title: "New visit" } })).status()).toBe(400);
    expect((await owner.post("/api/site-visits", { data: { projectId: p.id, companyId: p.companyId, title: p.name, clientRequestId: key } })).status()).toBe(409);
    expect((await owner.post("/api/uploads", upload)).status()).toBe(404);
    expect((await owner.patch(`/api/uploads/${attachment.id}`, { data: { caption: "Changed" } })).status()).toBe(404);
    expect((await owner.delete(`/api/uploads/${attachment.id}`)).status()).toBe(404);
    expect((await owner.post(`/api/site-visits/${v.id}/convert`)).status()).toBe(404);
    const file = await owner.get(`/api/uploads/${attachment.id}/file`); expect(file.status()).toBe(200); expect(await file.body()).toEqual(png);
    expect((await owner.get(`/api/quotations/${q.id}`)).status()).toBe(200);
    expect((await owner.get(`/api/quotations/${q.id}/pdf`)).status()).toBe(200);
    expect((await owner.post(`/api/projects/${p.id}/restore`)).status()).toBe(200);
    expect((await owner.get(`/api/site-visits/${v.id}`)).status()).toBe(200);
    const restored = (await (await owner.get(`/api/projects?search=${encodeURIComponent(p.name)}`)).json())[0];
    expect(restored.isPinned).toBe(true); expect(restored.isStarred).toBe(true);
    expect(restored._count.siteVisits).toBe(1);
    // An administrator can manage a staff-created project too.
    expect((await request.delete(`/api/projects/${p.id}`)).status()).toBe(200);
    expect((await request.post(`/api/projects/${p.id}/restore`)).status()).toBe(200);
  } finally { await owner.dispose(); }
});

test("project controls handle cancel, request failure, mobile delete and restoration", async ({ page, request }) => {
  const p = await createProject(request, "UI controls");
  const search = encodeURIComponent(p.name);
  await page.goto(`/projects?search=${search}`);
  const card = page.getByRole("article", { name: p.name, exact: true });
  await page.route(`**/api/projects/${p.id}/preferences`, (route) => route.fulfill({ status: 503, json: { error: "Connection interrupted. Please try again." } }));
  await card.getByRole("button", { name: `Pin ${p.name}`, exact: true }).click();
  await expect(card.getByRole("alert")).toContainText("Connection interrupted");
  await expect(card.getByRole("button", { name: `Pin ${p.name}`, exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.unroute(`**/api/projects/${p.id}/preferences`);
  await card.getByRole("button", { name: `Pin ${p.name}`, exact: true }).click();
  await expect(card.getByRole("button", { name: `Unpin ${p.name}`, exact: true })).toHaveAttribute("aria-pressed", "true");
  // Wait for the pin refresh to finish before opening consecutive native dialogs.
  await expect(card.getByRole("button", { name: `Unpin ${p.name}`, exact: true })).toBeEnabled();
  page.once("dialog", (dialog) => dialog.dismiss());
  await card.getByRole("button", { name: `Delete ${p.name}`, exact: true }).click();
  expect((await prisma.project.findUniqueOrThrow({ where: { id: p.id } })).deletedAt).toBeNull();
  await page.route(`**/api/projects/${p.id}`, (route) => route.request().method() === "DELETE" ? route.fulfill({ status: 503, json: { error: "Deletion interrupted. Please try again." } }) : route.continue());
  page.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: `Delete ${p.name}`, exact: true }).click();
  await expect(card.getByRole("alert")).toContainText("Deletion interrupted");
  expect((await prisma.project.findUniqueOrThrow({ where: { id: p.id } })).deletedAt).toBeNull();
  await page.unroute(`**/api/projects/${p.id}`);
  page.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: `Delete ${p.name}`, exact: true }).click();
  await expect(card).toHaveCount(0);
  await expect(page.getByRole("main").getByText("0 projects", { exact: true })).toBeVisible();
  const sections = page.getByRole("navigation", { name: "Project sections" });
  await sections.getByRole("link", { name: "Recently deleted", exact: true }).click();
  await expect(sections.getByRole("link", { name: "Recently deleted", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(card.getByRole("button", { name: `Restore ${p.name}`, exact: true })).toBeVisible();
  await card.getByRole("button", { name: `Restore ${p.name}`, exact: true }).click();
  await expect(card).toHaveCount(0);
  await expect(page.getByRole("main").getByText("0 projects", { exact: true })).toBeVisible();
  await sections.getByRole("link", { name: "All projects", exact: true }).click();
  await expect(card).toHaveCount(1);
  const size = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
  expect(size.content).toBeLessThanOrEqual(size.viewport);
  await page.screenshot({ path: ".local/previews/project-actions-mobile.png", fullPage: true });
  await page.goto(`/projects/${p.id}`);
  await page.getByRole("button", { name: `Star ${p.name}`, exact: true }).click();
  await expect(page.getByRole("button", { name: `Unstar ${p.name}`, exact: true })).toHaveAttribute("aria-pressed", "true");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: `Delete ${p.name}`, exact: true }).click();
  await page.waitForURL("**/projects");
});
