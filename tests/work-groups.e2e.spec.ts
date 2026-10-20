import { loginWithEmail } from "./helpers/auth";
import { test, expect, request as apiRequest, type APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
const prisma = new PrismaClient();
const prefix = `Group check ${randomUUID().slice(0, 8)}`;
const userIds: string[] = [], projectIds: string[] = [];
let companies: { id: string; name: string }[], adminId: string;
async function login(api: APIRequestContext, email = process.env.CRM_TEST_EMAIL || "admin@sjss.com", password = process.env.CRM_TEST_PASSWORD || "admin123") {
  await loginWithEmail(api, email, password);
  const user = (await (await api.get("/api/auth/session")).json()).user; expect(user).toBeTruthy(); return user;
}
async function employee(admin: APIRequestContext, baseURL: string, suffix: string) {
  const email = `${randomUUID()}@example.invalid`, password = randomUUID();
  const response = await admin.post("/api/users", { data: { email, password, role: "USER", name: `${prefix} ${suffix}` } });
  expect(response.status()).toBe(201); const user = await response.json(); userIds.push(user.id);
  const api = await apiRequest.newContext({ baseURL }); await login(api, email, password);
  return { ...user, api, password };
}
async function createGroup(api: APIRequestContext, name: string, members: string[], companyId = companies[0].id, projectId?: string) {
  const response = await api.post("/api/work-groups", { data: { name: `${prefix} ${name}`, companyId, memberIds: members, projectId } });
  expect(response.status()).toBe(201); return response.json();
}
const message = (body: string, isAnnouncement = false) => ({ body, isAnnouncement, clientRequestId: randomUUID() });
test.beforeEach(async ({ request, page, baseURL }) => {
  if (!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) throw new Error("Local test instance required");
  adminId = (await login(request)).id;
  await page.context().addCookies((await request.storageState()).cookies);
  companies = await (await request.get("/api/companies")).json();
});
test.afterAll(async () => {
  await prisma.workGroup.deleteMany({ where: { name: { startsWith: prefix } } });
  await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

test("only selected members can read or send, admins manage official posts, and company/project links stay separate", async ({ request, baseURL }) => {
  const member = await employee(request, baseURL!, "Member"), outsider = await employee(request, baseURL!, "Outsider");
  const anonymous = await apiRequest.newContext({ baseURL });
  try {
    const project = await prisma.project.create({ data: { name: `${prefix} Project`, companyId: companies[0].id, createdById: adminId } }); projectIds.push(project.id);
    const group = await createGroup(request, "Private site", [member.id], companies[0].id, project.id);
    const other = await createGroup(request, "Other company", [member.id], companies[1].id);
    expect((await anonymous.get("/api/work-groups")).status()).toBe(401);
    expect((await anonymous.post(`/api/work-groups/${group.id}/messages`, { data: message("No access") })).status()).toBe(401);
    expect((await (await outsider.api.get("/api/work-groups")).json()).total).toBe(0);
    expect((await outsider.api.get(`/api/work-groups/${group.id}/messages`)).status()).toBe(404);
    expect((await outsider.api.post(`/api/work-groups/${group.id}/messages`, { data: message("No access") })).status()).toBe(404);
    await prisma.user.update({ where: { id: outsider.id }, data: { role: "ADMIN" } });
    // A role promotion requires a fresh administrator email verification.
    await login(outsider.api, outsider.email, outsider.password);
    expect((await outsider.api.get(`/api/work-groups/${group.id}/messages`)).status()).toBe(404);
    expect((await outsider.api.patch(`/api/work-groups/${group.id}`, { data: { name: `${prefix} Forbidden edit`, memberIds: [outsider.id] } })).status()).toBe(404);
    expect((await member.api.post("/api/work-groups", { data: { name: "Forbidden", companyId: companies[0].id, memberIds: [adminId] } })).status()).toBe(403);
    expect((await member.api.patch(`/api/work-groups/${group.id}`, { data: { name: "Forbidden", memberIds: [member.id] } })).status()).toBe(403);
    expect((await member.api.post(`/api/work-groups/${group.id}/messages`, { data: message("Fake official", true) })).status()).toBe(403);
    for (const bad of [{ ...message("  ") }, { ...message("x".repeat(4001)) }, { ...message("Spoof"), authorId: adminId }])
      expect((await member.api.post(`/api/work-groups/${group.id}/messages`, { data: bad })).status()).toBe(400);
    const data = message("Staff progress report");
    const sent = await Promise.all([member.api.post(`/api/work-groups/${group.id}/messages`, { data }), member.api.post(`/api/work-groups/${group.id}/messages`, { data })]);
    expect(sent.map((r) => r.status())).toEqual([201, 201]);
    expect(await prisma.workGroupMessage.count({ where: { clientRequestId: data.clientRequestId } })).toBe(1);
    expect((await member.api.post(`/api/work-groups/${group.id}/messages`, { data: { ...data, body: "Changed reuse" } })).status()).toBe(409);
    expect((await member.api.post(`/api/work-groups/${other.id}/messages`, { data })).status()).toBe(409);
    expect((await request.post(`/api/work-groups/${group.id}/messages`, { data: message("Official work instructions", true) })).status()).toBe(201);
    const official = await (await member.api.get(`/api/work-groups/${group.id}/messages?view=announcements`)).json();
    expect(official.messages.map((m: { body: string }) => m.body)).toEqual(["Official work instructions"]);
    const scoped = await (await member.api.get(`/api/work-groups?company=${companies[1].id}`)).json();
    expect((await member.api.get(`/api/work-groups/${group.id}/messages`)).headers()["cache-control"]).toContain("no-store");
    expect(scoped.groups.map((g: { id: string }) => g.id)).toEqual([other.id]);
    expect((await member.api.get(`/api/work-groups/${group.id}/messages?company=${companies[1].id}`)).status()).toBe(404);
    expect((await request.post("/api/work-groups", { data: { name: `${prefix} Cross-company`, companyId: companies[1].id, projectId: project.id, memberIds: [member.id] } })).status()).toBe(400);
    expect((await request.patch(`/api/work-groups/${group.id}`, { data: { name: `${prefix} Private site`, memberIds: [adminId, "missing-user"] } })).status()).toBe(400);
    expect((await member.api.get(`/api/work-groups/${group.id}/messages`)).status()).toBe(200);
    expect((await request.patch(`/api/work-groups/${group.id}`, { data: { name: `${prefix} Private site`, memberIds: [adminId] } })).status()).toBe(200);
    expect((await member.api.get(`/api/work-groups/${group.id}/messages`)).status()).toBe(404);
    expect((await member.api.post(`/api/work-groups/${group.id}/messages`, { data: message("Removed user") })).status()).toBe(404);
  } finally { await member.api.dispose(); await outsider.api.dispose(); await anonymous.dispose(); }
});

test("message history uses complete cursor pages, including tied timestamps and the announcements filter", async ({ request, baseURL }) => {
  const member = await employee(request, baseURL!, "History member");
  try {
    const group = await createGroup(request, "History", [member.id]);
    const createdAt = new Date("2026-10-16T00:00:00Z");
    const rows = Array.from({ length: 125 }, (_, i) => ({ id: `${randomUUID().slice(0, 8)}-${String(i).padStart(4, "0")}`, groupId: group.id, authorId: adminId, authorName: "Test administrator", body: `History ${i}`, isAnnouncement: i % 2 === 0, clientRequestId: randomUUID(), createdAt }));
    await prisma.workGroupMessage.createMany({ data: rows });
    const first = await (await member.api.get(`/api/work-groups/${group.id}/messages`)).json();
    expect(first.messages).toHaveLength(50); expect(first.hasMore).toBe(true);
    const second = await (await member.api.get(`/api/work-groups/${group.id}/messages?before=${first.messages[0].id}`)).json();
    const third = await (await member.api.get(`/api/work-groups/${group.id}/messages?before=${second.messages[0].id}`)).json();
    expect(second.messages).toHaveLength(50); expect(third.messages).toHaveLength(25); expect(third.hasMore).toBe(false);
    expect(new Set([...first.messages, ...second.messages, ...third.messages].map((m: { id: string }) => m.id)).size).toBe(125);
    const official = await (await member.api.get(`/api/work-groups/${group.id}/messages?view=announcements`)).json();
    const olderOfficial = await (await member.api.get(`/api/work-groups/${group.id}/messages?view=announcements&before=${official.messages[0].id}`)).json();
    expect(official.messages).toHaveLength(50); expect(olderOfficial.messages).toHaveLength(13);
    expect([...official.messages, ...olderOfficial.messages].every((m: { isAnnouncement: boolean }) => m.isAnnouncement)).toBe(true);
    const added = await (await request.post(`/api/work-groups/${group.id}/messages`, { data: message("Newer than cursor") })).json();
    const newer = await (await member.api.get(`/api/work-groups/${group.id}/messages?after=${first.messages.at(-1).id}`)).json();
    expect(newer.messages.map((m: { id: string }) => m.id)).toEqual([added.id]);
    expect((await member.api.get(`/api/work-groups/${group.id}/messages?before=missing`)).status()).toBe(400);
  } finally { await member.api.dispose(); }
});

test("mobile group creation, official announcements, two-user refresh and lost-response retry work together", async ({ request, page, browser, baseURL }) => {
  const member = await employee(request, baseURL!, "Mobile employee");
  const context = await browser.newContext({ storageState: await member.api.storageState(), viewport: { width: 390, height: 844 } });
  const staffPage = await context.newPage();
  try {
    const project = await prisma.project.create({ data: { name: `${prefix} Mobile project`, companyId: companies[0].id, createdById: adminId } }); projectIds.push(project.id);
    await page.goto("/inbox");
    await page.getByRole("navigation", { name: "Communication sections" }).getByRole("link", { name: "Work groups", exact: true }).click();
    await page.getByRole("link", { name: "New group", exact: true }).click();
    await page.getByLabel("Group name", { exact: true }).fill(`${prefix} Mobile team`);
    await page.getByLabel("Company", { exact: true }).selectOption(companies[0].id);
    await page.getByLabel("Project", { exact: true }).selectOption(project.id);
    await page.getByRole("checkbox", { name: member.name, exact: true }).check();
    await page.getByLabel("Company", { exact: true }).selectOption(companies[1].id);
    await expect(page.getByLabel("Project", { exact: true })).toHaveValue("");
    await expect(page.getByRole("checkbox", { name: member.name, exact: true })).not.toBeChecked();
    await page.getByLabel("Company", { exact: true }).selectOption(companies[0].id);
    await page.getByLabel("Project", { exact: true }).selectOption(project.id);
    await page.getByRole("checkbox", { name: member.name, exact: true }).check();
    await page.getByRole("button", { name: "Create work group", exact: true }).click();
    await page.waitForURL((url) => /^\/work-groups\/[^/]+$/.test(url.pathname) && url.pathname !== "/work-groups/new");
    const id = new URL(page.url()).pathname.split("/").at(-1)!;
    await expect(page.getByRole("link", { name: `Open project: ${project.name}`, exact: true })).toHaveAttribute("href", `/projects/${project.id}`);
    await staffPage.goto(`/work-groups/${id}`);
    await staffPage.bringToFront();
    await expect(staffPage.getByRole("button", { name: "Send to group", exact: true })).toBeDisabled();
    await page.bringToFront();
    await page.getByRole("textbox", { name: "Group message", exact: true }).fill("Meet at the site at 9am.");
    await page.getByRole("checkbox", { name: "Official announcement", exact: true }).check();
    await page.getByRole("button", { name: "Send to group", exact: true }).click();
    await expect(page.getByRole("log")).toContainText("Meet at the site at 9am.");
    await staffPage.bringToFront();
    await expect(staffPage.getByRole("log")).toContainText("Meet at the site at 9am.", { timeout: 10000 });
    await expect(staffPage.getByRole("checkbox", { name: "Official announcement", exact: true })).toHaveCount(0);
    await staffPage.getByRole("textbox", { name: "Group message", exact: true }).fill("Materials have arrived.");
    await staffPage.getByRole("button", { name: "Send to group", exact: true }).click();
    await page.bringToFront();
    await expect(page.getByRole("log")).toContainText("Materials have arrived.", { timeout: 10000 });
    await page.getByRole("button", { name: "Announcements", exact: true }).click();
    await expect(page.getByRole("log")).toContainText("Meet at the site at 9am.");
    await expect(page.getByRole("log")).not.toContainText("Materials have arrived.");
    await page.getByRole("button", { name: "Conversation", exact: true }).click();
    let failed = false;
    await page.route(`**/api/work-groups/${id}/messages`, async (route) => {
      if (route.request().method() !== "POST" || failed) return route.continue();
      failed = true; await route.fetch(); await route.fulfill({ status: 503, json: { error: "Response lost after saving" } });
    });
    await page.getByRole("textbox", { name: "Group message", exact: true }).fill("One message despite retry");
    await page.getByRole("button", { name: "Send to group", exact: true }).click();
    await expect(page.getByRole("region", { name: "Group conversation" }).getByRole("alert").filter({ hasText: "Response lost after saving" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Group message", exact: true })).toHaveValue("One message despite retry");
    await page.getByRole("button", { name: "Send to group", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Group message", exact: true })).toHaveValue("");
    expect(await prisma.workGroupMessage.count({ where: { groupId: id, body: "One message despite retry" } })).toBe(1);
    await page.unroute(`**/api/work-groups/${id}/messages`);
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => window.scrollTo(0, 0));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `.local/previews/work-group-${width}.png`, fullPage: true });
    }
    await page.locator("summary:visible").click();
    await page.getByRole("checkbox", { name: member.name, exact: true }).uncheck();
    await page.getByRole("button", { name: "Save group settings", exact: true }).click();
    await staffPage.bringToFront();
    await expect(staffPage.getByRole("textbox", { name: "Group message", exact: true })).toBeDisabled({ timeout: 10000 });
    await page.bringToFront();
    await page.getByRole("group", { name: "Filter the whole system by company" }).getByRole("button", { name: companies[1].name, exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/work-groups");
    await expect(page.getByRole("link", { name: `Open group ${prefix} Mobile team`, exact: true })).toHaveCount(0);
  } finally { await context.close(); await member.api.dispose(); }
});
