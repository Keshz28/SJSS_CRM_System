import { loginWithEmail } from "./helpers/auth";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();
const visitIds: string[] = [], projectIds: string[] = [];
const prefix = `Compact ${randomUUID().slice(0, 8)}`;
let userId: string;
let companies: { id: string; name: string }[];
const visitLinks = (page: Page) => page.getByRole("list", { name: "Site visits", exact: true }).getByRole("link");

test.beforeEach(async ({ request, page, baseURL }) => {
  if (!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) throw new Error("Local test instance required");
  await loginWithEmail(request);
  userId = (await (await request.get("/api/auth/session")).json()).user.id;
  expect(userId).toBeTruthy();
  await page.context().addCookies((await request.storageState()).cookies);
  companies = await (await request.get("/api/companies")).json();
});
test.afterAll(async () => {
  await prisma.siteVisit.deleteMany({ where: { id: { in: visitIds } } });
  await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  await prisma.$disconnect();
});

test("compact visits paginate beyond 60 records, retain filters and separate companies", async ({ page, request }) => {
  const project = await prisma.project.create({ data: { name: `${prefix} Job`, companyId: companies[0].id, createdById: userId } });
  projectIds.push(project.id);
  const fixtures = Array.from({ length: 67 }, (_, i) => ({
    id: randomUUID(), title: `${prefix} Visit ${String(i).padStart(2, "0")}`,
    companyId: companies[i < 64 ? 0 : 1].id, projectId: i < 64 ? project.id : null,
    status: i % 3 === 0 ? "QUOTED" as const : "CAPTURED" as const, createdById: userId,
    location: "Sample construction site", createdAt: new Date(Date.UTC(2026, 9, 1, 0, i)),
  }));
  await prisma.siteVisit.createMany({ data: fixtures }); visitIds.push(...fixtures.map((v) => v.id));
  const search = encodeURIComponent(prefix);
  await page.goto(`/site-visits?search=${search}`);
  await expect(visitLinks(page)).toHaveCount(20);
  await expect(page.getByRole("link", { name: "Compact list", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("navigation", { name: "Site visit pages" })).toContainText("Page 1 of 4");
  await expect(visitLinks(page).first()).toHaveAttribute("aria-label", `Open site visit ${fixtures[66].title}`);
  for (let i = 0; i < 3; i++) {
    await page.getByRole("link", { name: "Next", exact: true }).click();
    await expect(page.getByRole("navigation", { name: "Site visit pages" })).toContainText(`Page ${i + 2} of 4`);
  }
  await expect(visitLinks(page)).toHaveCount(7);
  await expect(page.getByRole("link", { name: "Next", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: `Open site visit ${fixtures[0].title}`, exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Gallery", exact: true }).click();
  await expect(page.getByRole("link", { name: "Gallery", exact: true })).toHaveAttribute("aria-current", "page");
  expect(new URL(page.url()).searchParams.get("page")).toBe("4");
  expect(new URL(page.url()).searchParams.get("search")).toBe(prefix);
  const returnTo = `/site-visits?${new URLSearchParams({ search: prefix, view: "gallery", page: "4" })}`;
  await page.getByRole("link", { name: `Open site visit ${fixtures[0].title}`, exact: true }).click();
  const backToVisits = page.getByRole("link", { name: "Back to site visits", exact: true });
  await expect(backToVisits).toHaveAttribute("href", returnTo);
  await expect(page.getByRole("link", { name: `Open project: ${project.name}`, exact: true })).toHaveAttribute("href", `/projects/${project.id}`);
  await page.reload();
  await expect(backToVisits).toHaveAttribute("href", returnTo);
  await page.getByRole("link", { name: "Add photos or voice notes", exact: true }).click();
  await page.getByRole("link", { name: "← Back to site update", exact: true }).click();
  await expect(backToVisits).toHaveAttribute("href", returnTo);
  await page.getByRole("link", { name: "Add photos or voice notes", exact: true }).click();
  await page.getByRole("button", { name: "Save update", exact: true }).click();
  await expect(backToVisits).toHaveAttribute("href", returnTo);
  await backToVisits.click();
  await expect(page.getByRole("navigation", { name: "Site visit pages" })).toContainText("Page 4 of 4");
  await expect(visitLinks(page)).toHaveCount(7);
  await page.getByRole("combobox", { name: "Visit status" }).selectOption("QUOTED");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Site visit pages" })).toContainText("Page 1 of 2");
  await expect(page.getByRole("link", { name: "Gallery", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(visitLinks(page)).toHaveCount(20);
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await expect(visitLinks(page)).toHaveCount(3);
  await expect(visitLinks(page).filter({ hasText: "Captured" })).toHaveCount(0);
  const companyButton = page.getByRole("group", { name: "Filter the whole system by company" }).getByRole("button", { name: companies[1].name, exact: true });
  await companyButton.click();
  await expect(companyButton).toHaveAttribute("aria-pressed", "true");
  await expect(companyButton).toBeEnabled();
  await expect(visitLinks(page)).toHaveCount(1);
  await expect(visitLinks(page)).toHaveAttribute("aria-label", `Open site visit ${fixtures[66].title}`);
  await expect(page.getByRole("navigation", { name: "Site visit pages" })).toContainText("Page 1 of 1");
  const allButton = page.getByRole("group", { name: "Filter the whole system by company" }).getByRole("button", { name: "All companies", exact: true });
  await allButton.click(); await expect(allButton).toBeEnabled();
  await page.getByRole("textbox", { name: "Search site visits" }).fill(project.name);
  await page.getByRole("combobox", { name: "Visit status" }).selectOption("");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("main").getByText("Newest first · 1–20 of 64 visits", { exact: true })).toBeVisible();
  const api = await (await request.get(`/api/site-visits?search=${encodeURIComponent(project.name)}`)).json();
  expect(api.total).toBe(64);
  await page.getByRole("textbox", { name: "Search site visits" }).fill(`${prefix} nonexistent`);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No matching site visits" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Clear filters", exact: true })).toBeVisible();
});

test("compact rows fit phones and desktops and use safe audio, video and failed-image previews", async ({ page }) => {
  const label = `${prefix} Media`;
  const fixtures = await Promise.all(["audio/webm", "video/mp4", "image/png"].map(async (mimetype, i) => {
    const visit = await prisma.siteVisit.create({ data: {
      title: `${label} ${i}`, companyId: companies[0].id, createdById: userId,
      contactName: "Customer contact", location: "A longer site address for checking the compact row layout",
      attachments: { create: { filename: "preview", filepath: `test-missing-${randomUUID()}`, filesize: 1, mimetype, uploadedById: userId } },
    }, include: { attachments: true } });
    visitIds.push(visit.id); return visit;
  }));
  const requestedMedia: string[] = [];
  await page.route("**/api/uploads/*/file", async (route) => {
    requestedMedia.push(route.request().url());
    await route.fulfill({ status: 404 });
  });
  await page.goto(`/site-visits?search=${encodeURIComponent(label)}`);
  await expect(visitLinks(page)).toHaveCount(3);
  await expect.poll(() => requestedMedia.length).toBeGreaterThan(0);
  await expect(page.getByRole("list", { name: "Site visits", exact: true }).locator("img")).toHaveCount(0);
  expect(requestedMedia.every((url) => url.includes(fixtures[2].attachments[0].id))).toBe(true);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const sizes = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
    for (const row of await visitLinks(page).all()) expect((await row.boundingBox())!.height).toBeLessThan(140);
    await page.screenshot({ path: `.local/previews/site-visits-compact-${width}.png`, fullPage: true });
  }
  await page.getByRole("link", { name: "Gallery", exact: true }).click();
  await expect(visitLinks(page)).toHaveCount(3);
  await page.screenshot({ path: ".local/previews/site-visits-gallery.png", fullPage: true });
  await page.unroute("**/api/uploads/*/file");
  await page.getByRole("link", { name: `Open site visit ${fixtures[0].title}`, exact: true }).click();
  await page.waitForURL((url) => url.pathname === `/site-visits/${fixtures[0].id}`);
  const back = page.getByRole("link", { name: "Back to site visits", exact: true });
  await expect(back).toHaveAttribute("href", `/site-visits?${new URLSearchParams({ search: label, view: "gallery", page: "1" })}`);
  await back.click();
  await expect(visitLinks(page)).toHaveCount(3);
  await expect(page.getByRole("link", { name: "Gallery", exact: true })).toHaveAttribute("aria-current", "page");
  await page.goto(`/site-visits/${fixtures[0].id}?returnTo=${encodeURIComponent("https://example.invalid/site-visits")}`);
  await expect(back).toHaveAttribute("href", "/site-visits");
  await page.goto(`/site-visits/${fixtures[0].id}`);
  await expect(back).toHaveAttribute("href", "/site-visits");
});
