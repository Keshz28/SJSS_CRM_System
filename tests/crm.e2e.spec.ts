import { loginWithEmail } from "./helpers/auth";
import {
  test,
  expect,
  request as playwrightRequest,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { removeUnreferencedFile } from "../lib/file-storage";
const prisma = new PrismaClient();
const projectIds: string[] = [];
const userIds: string[] = [];
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA6sAAAAASUVORK5CYII=",
  "base64",
);
const photo = { name: "site-photo.png", mimeType: "image/png", buffer: png };
const prefix = `E2E ${randomUUID()}`;
async function expectAudioPlayback(page: Page) {
  // React streaming can briefly retain a hidden copy while replacing the page.
  const player = page.locator("audio:visible");
  await expect(player).toHaveCount(1);
  await expect
    .poll(() => player.evaluate((audio: HTMLAudioElement) => audio.readyState))
    .toBeGreaterThanOrEqual(1);
  expect(
    await player.evaluate((audio: HTMLAudioElement) => audio.error?.message || null),
  ).toBeNull();
  expect(
    await player.evaluate((audio: HTMLAudioElement) => audio.duration),
  ).toBeGreaterThan(0);
  await player.evaluate(async (audio: HTMLAudioElement) => {
    audio.currentTime = 0;
    await audio.play();
  });
  await expect
    .poll(() => player.evaluate((audio: HTMLAudioElement) => audio.currentTime))
    .toBeGreaterThan(0.15);
  await player.evaluate((audio: HTMLAudioElement) => audio.pause());
}
async function login(
  api: APIRequestContext,
  email = process.env.CRM_TEST_EMAIL || "admin@sjss.com",
  password = process.env.CRM_TEST_PASSWORD || "admin123",
) {
  await loginWithEmail(api, email, password);
  return (await api.get("/api/auth/session")).json();
}
async function project(api: APIRequestContext) {
  const companies = await (await api.get("/api/companies")).json();
  const response = await api.post("/api/projects", {
    data: {
      name: `${prefix} project`,
      companyId: companies[0].id,
      location: "Review site",
      status: "ACTIVE",
    },
  });
  expect(response.status()).toBe(201);
  const value = await response.json();
  projectIds.push(value.id);
  return value;
}
test.beforeEach(async ({ request, page, baseURL }) => {
  if (
    !baseURL ||
    !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)
  )
    throw new Error(
      "These tests create temporary records and must target a local test instance.",
    );
  expect((await login(request)).user.role).toBe("ADMIN");
  await page.context().addCookies((await request.storageState()).cookies);
});
test.afterAll(async () => {
  const generatedCustomers = await prisma.customer.findMany({
    where: {
      name: { startsWith: prefix },
      quotations: { some: { projectId: { in: projectIds } } },
    },
    select: { id: true },
  });
  const attachments = await prisma.attachment.findMany({
    where: {
      OR: [
        { siteVisit: { projectId: { in: projectIds } } },
        { quotation: { projectId: { in: projectIds } } },
      ],
    },
  });
  await prisma.siteVisit.deleteMany({
    where: { projectId: { in: projectIds } },
  });
  await prisma.quotation.deleteMany({
    where: { projectId: { in: projectIds } },
  });
  await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  await prisma.customer.deleteMany({
    where: { id: { in: generatedCustomers.map((c) => c.id) } },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  for (const a of attachments) await removeUnreferencedFile(a.filepath);
  await prisma.$disconnect();
});

test("deactivation, role changes and password reset apply to open sessions", async ({
  request,
  baseURL,
}) => {
  const response = await request.post("/api/users", {
    data: {
      email: `e2e-${randomUUID()}@example.invalid`,
      name: "Temporary test user",
      password: "Temporary-E2E-821!",
      role: "ADMIN",
    },
  });
  expect(response.status()).toBe(201);
  const user = await response.json();
  userIds.push(user.id);
  const other = await playwrightRequest.newContext({ baseURL });
  expect(
    (await login(other, user.email.toUpperCase(), "Temporary-E2E-821!")).user
      .id,
  ).toBe(user.id);
  expect(
    (
      await request.patch(`/api/users/${user.id}`, { data: { role: "USER" } })
    ).ok(),
  ).toBeTruthy();
  expect((await other.get("/api/users")).status()).toBe(403);
  await request.patch(`/api/users/${user.id}`, { data: { isActive: false } });
  expect((await other.get("/api/site-visits")).status()).toBe(401);
  expect(
    (await login(other, user.email, "Temporary-E2E-821!")).user,
  ).toBeUndefined();
  await request.patch(`/api/users/${user.id}`, { data: { isActive: true } });
  expect((await login(other, user.email, "Temporary-E2E-821!")).user.id).toBe(
    user.id,
  );
  await request.patch(`/api/users/${user.id}`, {
    data: { password: "Replacement-E2E-993!" },
  });
  expect((await other.get("/api/site-visits")).status()).toBe(401);
  await other.dispose();
});

test("uploads are private and duplicate-safe; quote conversion preserves original media and PDFs work", async ({
  request,
  baseURL,
}) => {
  const p = await project(request);
  const body = {
    projectId: p.id,
    companyId: p.companyId,
    title: `${prefix} survey`,
    clientRequestId: randomUUID(),
  };
  const first = await (
    await request.post("/api/site-visits", { data: body })
  ).json();
  const retry = await (
    await request.post("/api/site-visits", { data: body })
  ).json();
  expect(retry.id).toBe(first.id);
  const upload = {
    multipart: {
      file: photo,
      siteVisitId: first.id,
      clientUploadId: randomUUID(),
      caption: "Kitchen — before work",
    },
  };
  const attachment = await (await request.post("/api/uploads", upload)).json();
  expect(attachment.id).toBeTruthy();
  expect((await (await request.post("/api/uploads", upload)).json()).id).toBe(
    attachment.id,
  );
  const anonymous = await playwrightRequest.newContext({ baseURL });
  expect(
    (await anonymous.get(`/api/uploads/${attachment.id}/file`)).status(),
  ).toBe(401);
  expect((await anonymous.get("/uploads/old/photo.png")).status()).toBe(404);
  await anonymous.dispose();
  expect(
    (
      await request.get(`/api/uploads/${attachment.id}/file`, {
        headers: { Range: "bytes=0-9" },
      })
    ).status(),
  ).toBe(206);
  expect(
    (
      await request.get(`/api/uploads/${attachment.id}/file`, {
        headers: { Range: "bytes=999999-" },
      })
    ).status(),
  ).toBe(416);
  expect(
    (
      await request.post("/api/uploads", {
        multipart: {
          siteVisitId: first.id,
          file: {
            name: "fake.png",
            mimeType: "image/png",
            buffer: Buffer.from("<html>not a photo</html>"),
          },
        },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.patch(`/api/uploads/${attachment.id}`, {
        data: { caption: "Kitchen — damaged wall" },
      })
    ).ok(),
  ).toBeTruthy();
  const conversions = await Promise.all([
    request.post(`/api/site-visits/${first.id}/convert`),
    request.post(`/api/site-visits/${first.id}/convert`),
  ]);
  const quotes = await Promise.all(conversions.map((r) => r.json()));
  expect(quotes[0].quotationId).toBe(quotes[1].quotationId);
  const visit = await (
    await request.get(`/api/site-visits/${first.id}`)
  ).json();
  expect(visit.attachments).toHaveLength(1);
  const quotation = await (
    await request.get(`/api/quotations/${quotes[0].quotationId}`)
  ).json();
  expect(quotation.projectId).toBe(p.id);
  expect(quotation.attachments).toHaveLength(1);
  expect(quotation.attachments[0].caption).toBe("Kitchen — damaged wall");
  const pdf = await request.get(`/api/quotations/${quotation.id}/pdf`);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  const report = await request.get("/api/reports/pdf");
  expect(report.status()).toBe(200);
  await request.delete(`/api/uploads/${attachment.id}`);
  expect(
    (
      await request.get(`/api/uploads/${quotation.attachments[0].id}/file`)
    ).status(),
  ).toBe(200);
});

test("phone project creation, captions, draft restore and interrupted uploads", async ({
  page,
  request,
}) => {
  await page.goto("/projects/new");
  await page
    .getByRole("textbox", { name: "Project name", exact: true })
    .fill(`${prefix} mobile`);
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page.waitForURL(
    (url) =>
      /^\/projects\/[^/]+$/.test(url.pathname) &&
      url.pathname !== "/projects/new",
  );
  const id = new URL(page.url()).pathname.split("/").pop()!;
  projectIds.push(id);
  await page
    .getByRole("link", { name: "Capture update", exact: true })
    .first()
    .click();
  const title = page.getByRole("textbox", {
    name: "Update title",
    exact: true,
  });
  await title.fill("Kitchen survey");
  await page.locator('input[type="file"]').nth(1).setInputFiles(photo);
  const caption = page.getByRole("textbox", {
    name: "Description for item 1",
    exact: true,
  });
  await caption.fill("Kitchen wall — before renovation");
  await expect(page.getByRole("status")).toContainText(
    "Draft saved on this device",
  );
  await page.reload();
  await expect(title).toHaveValue("Kitchen survey");
  await expect(caption).toHaveValue("Kitchen wall — before renovation");
  let interrupted = false;
  await page.route("**/api/uploads", async (route) => {
    if (!interrupted) {
      interrupted = true;
      await route.fetch();
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Simulated lost upload response" }),
      });
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Save update", exact: true }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Simulated lost upload response" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save update", exact: true }).click();
  await page.waitForURL(
    (url) =>
      /^\/site-visits\/[^/]+$/.test(url.pathname) &&
      url.pathname !== "/site-visits/new",
  );
  await expect(
    page.getByText("Kitchen wall — before renovation", { exact: true }),
  ).toBeVisible();
  const visits = await prisma.siteVisit.findMany({
    where: { projectId: id },
    include: { attachments: true },
  });
  expect(visits).toHaveLength(1);
  expect(visits[0].attachments).toHaveLength(1);
  await page
    .getByRole("link", { name: "Add photos or voice notes", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Update title", exact: true }),
  ).toBeDisabled();
  const width = await page.evaluate(() => ({
    viewport: innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(width.content).toBeLessThanOrEqual(width.viewport);
  await page.screenshot({
    path: ".local/previews/capture-mobile.png",
    fullPage: true,
  });
});

test("offline capture keeps media and can upload when connection returns", async ({
  page,
  request,
  context,
}) => {
  const p = await project(request);
  await page.goto(`/site-visits/new?projectId=${p.id}`);
  const title = page.getByRole("textbox", {
    name: "Update title",
    exact: true,
  });
  await title.fill("Offline draft");
  await page.locator('input[type="file"]').nth(1).setInputFiles(photo);
  await expect(page.getByRole("status")).toContainText(
    "Draft saved on this device",
  );
  await context.setOffline(true);
  await page.getByRole("button", { name: "Save update", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "You are offline" }),
  ).toBeVisible();
  expect(await prisma.siteVisit.count({ where: { projectId: p.id } })).toBe(0);
  await context.setOffline(false);
  await page.reload();
  await expect(title).toHaveValue("Offline draft");
  await expect(
    page.getByRole("textbox", { name: "Description for item 1", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save update", exact: true }).click();
  await page.waitForURL(
    (url) =>
      /^\/site-visits\/[^/]+$/.test(url.pathname) &&
      url.pathname !== "/site-visits/new",
  );
  expect(await prisma.siteVisit.count({ where: { projectId: p.id } })).toBe(1);
});

for (const mp4Playback of [true, false]) {
  test(`voice notes play before and after saving (${mp4Playback ? "preferred format" : "WebM fallback"})`, async ({
    page,
    request,
    context,
  }) => {
    const p = await project(request);
    if (!mp4Playback) {
      // Model an embedded browser that can record MP4 but cannot play it.
      await page.addInitScript(() => {
        const native = HTMLMediaElement.prototype.canPlayType;
        HTMLMediaElement.prototype.canPlayType = function (type) {
          return type.startsWith("audio/mp4") ? "" : native.call(this, type);
        };
      });
    }
    await context.grantPermissions(["microphone"]);
    await page.bringToFront();
    await page.goto(`/site-visits/new?projectId=${p.id}`);
    await page
      .getByRole("button", { name: "Record voice note", exact: true })
      .click();
    const stop = page.getByRole("button", {
      name: "Stop voice recording",
      exact: true,
    });
    await expect(stop).toBeVisible();
    // Wait for the recorder's clock rather than sleeping through browser startup.
    await expect(stop).toContainText("0:02", { timeout: 10000 });
    await stop.click();
    await expectAudioPlayback(page);
    await page
      .getByRole("textbox", { name: "Description for item 1", exact: true })
      .fill("Measurements for the kitchen");
    await page.getByRole("button", { name: "Save update", exact: true }).click();
    await page.waitForURL(
      (url) =>
        /^\/site-visits\/[^/]+$/.test(url.pathname) &&
        url.pathname !== "/site-visits/new",
    );
    await expectAudioPlayback(page);
    const audio = await prisma.attachment.findFirst({
      where: { siteVisit: { projectId: p.id } },
    });
    expect(audio?.mimetype).toMatch(/^audio\//);
    if (!mp4Playback) expect(audio?.mimetype).toBe("audio/webm");
    expect(audio?.filesize).toBeGreaterThan(0);
    expect((await request.get(`/api/uploads/${audio!.id}/file`)).status()).toBe(
      200,
    );
    await page.reload();
    await expectAudioPlayback(page);

    const url = `**/api/uploads/${audio!.id}/file`;
    await page.route(url, (route) => route.abort());
    await page.reload();
    const error = page.getByRole("alert").filter({
      hasText: "This recording couldn’t load or play here",
    });
    await expect(error).toBeVisible();
    await page.unroute(url);
    await page.getByRole("button", { name: "Retry audio", exact: true }).click();
    await expectAudioPlayback(page);
    await expect(error).toHaveCount(0);
  });
}

test("installation assets and an offline fallback are available without caching private pages", async ({
  page,
  request,
  context,
}) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  expect(
    manifest.icons.some((i: { sizes: string }) => i.sizes === "192x192"),
  ).toBeTruthy();
  expect(
    manifest.icons.some((i: { sizes: string }) => i.sizes === "512x512"),
  ).toBeTruthy();
  // A manifest can load even when its icons are missing or declare wrong sizes.
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).toContain("image/png");
    const png = await response.body();
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(icon.sizes);
  }
  await page.goto("/projects");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", /sj-logo-32\.png$/);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /sj-logo-180\.png$/);
  await page.evaluate(() => navigator.serviceWorker.ready);
  const keys = await page.evaluate(async () =>
    (
      await Promise.all(
        (await caches.keys()).map(async (key) =>
          (await (await caches.open(key)).keys()).map(
            (r) => new URL(r.url).pathname,
          ),
        ),
      )
    ).flat(),
  );
  expect(keys.length).toBeGreaterThan(0);
  expect(
    keys.some((k) => k.startsWith("/api/") || k === "/projects"),
  ).toBeFalsy();
  await context.setOffline(true);
  await page.goto("/projects?offline-check=1");
  await expect(
    page.getByRole("heading", { name: "You're offline" }),
  ).toBeVisible();
  await context.setOffline(false);
});

test("microphone permission can be cancelled or denied without blocking the form", async ({
  page,
  request,
}) => {
  const p = await project(request);
  await page.goto(`/site-visits/new?projectId=${p.id}`);
  await page.evaluate(() =>
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: () => new Promise(() => {}),
    }),
  );
  await page
    .getByRole("button", { name: "Record voice note", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save update", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Cancel microphone request", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save update", exact: true }),
  ).toBeEnabled();
  await page.evaluate(() =>
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: () =>
        Promise.reject(new DOMException("Denied", "NotAllowedError")),
    }),
  );
  await page
    .getByRole("button", { name: "Record voice note", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Microphone access was denied" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save update", exact: true }),
  ).toBeEnabled();
});

test("existing office pages and mobile navigation remain usable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const url of [
    "/dashboard",
    "/customers",
    "/quotations",
    "/quotations/new",
    "/quotations/import",
    "/kanban",
    "/reports",
    "/inbox",
    "/admin/users",
    "/admin/messages",
    "/settings",
    "/projects",
    "/site-visits",
  ]) {
    const response = await page.goto(url);
    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe(url);
  }
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("button", { name: "More", exact: true })
    .click();
  await page
    .getByRole("complementary")
    .first()
    .getByRole("link", { name: "Projects", exact: true })
    .click();
  await page.waitForURL("**/projects");
  await expect(
    page.getByRole("link", { name: "New project", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByRole("complementary")
        .first()
        .evaluate((el) => el.getBoundingClientRect().x),
    )
    .toBeLessThan(-250);
  const sizes = await page.evaluate(() => ({
    width: innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.width);
  await page.screenshot({
    path: ".local/previews/projects-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect
    .poll(() =>
      page
        .getByRole("complementary")
        .first()
        .evaluate((el) => el.getBoundingClientRect().x),
    )
    .toBe(0);
  await page.screenshot({
    path: ".local/previews/projects-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
