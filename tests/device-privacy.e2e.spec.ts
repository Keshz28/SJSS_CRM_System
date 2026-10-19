import { test, expect, type Page } from "@playwright/test";
import { loginWithEmail } from "./helpers/auth";

async function seed(page: Page, ownerId: string) {
  await page.evaluate(async (owner) => {
    localStorage.setItem(`sjss-group-draft:${owner}:test`, "private unfinished message");
    localStorage.setItem("sjss-group-draft:other-account:test", "other account message");
    localStorage.setItem("privacy-unrelated", "keep");
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("sjss-capture-v1", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("drafts");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction("drafts", "readwrite");
        tx.objectStore("drafts").put({ title: "private site draft", photo: new Blob(["photo"]) }, `capture:${owner}:privacy-test`);
        tx.objectStore("drafts").put({ title: "other account draft" }, "capture:other-account:privacy-test");
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    });
  }, ownerId);
}
async function stored(page: Page, ownerId: string) {
  return page.evaluate(async (owner) => {
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const request = indexedDB.open("sjss-capture-v1", 1);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction("drafts", "readonly"), keys = tx.objectStore("drafts").getAllKeys();
        keys.onsuccess = () => resolve(keys.result); tx.oncomplete = () => db.close(); tx.onerror = () => reject(tx.error);
      };
    });
    return { mine: keys.filter((key) => String(key).startsWith(`capture:${owner}:`)), other: keys.includes("capture:other-account:privacy-test"), message: localStorage.getItem(`sjss-group-draft:${owner}:test`), otherMessage: localStorage.getItem("sjss-group-draft:other-account:test"), unrelated: localStorage.getItem("privacy-unrelated") };
  }, ownerId);
}
test.beforeEach(async ({ request, page, baseURL }) => {
  if (!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) throw new Error("Local instance required");
  await loginWithEmail(request);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.setViewportSize({ width: 1280, height: 900 });
});

test("clearing device drafts needs confirmation and preserves other accounts and saved records", async ({ page, request }) => {
  const owner = (await (await request.get("/api/auth/session")).json()).user.id;
  const before = await (await request.get("/api/site-visits")).json();
  await page.goto("/settings"); await seed(page, owner);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Clear my device drafts" }).click();
  expect((await stored(page, owner)).mine).toHaveLength(1);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Clear my device drafts" }).click();
  await expect(page.getByRole("status")).toContainText("drafts were cleared");
  expect(await stored(page, owner)).toEqual({ mine: [], other: true, message: null, otherMessage: "other account message", unrelated: "keep" });
  expect(await (await request.get("/api/site-visits")).json()).toEqual(before);
});

test("clearing from another tab removes an active capture draft without bringing its contents back", async ({ page, request }) => {
  await page.goto("/site-visits/new");
  const title = page.getByLabel("Update title");
  await title.fill("Sensitive unfinished site notes");
  await expect(page.getByText("Draft saved on this device", { exact: true })).toBeVisible();
  const settings = await page.context().newPage();
  try {
    await settings.goto("/settings");
    settings.once("dialog", (dialog) => dialog.accept());
    await settings.getByRole("button", { name: "Clear my device drafts" }).click();
    await expect(settings.getByRole("status")).toContainText("drafts were cleared");
    await expect(title).toHaveValue("");
    await page.reload(); await expect(title).toHaveValue("");
    expect((await (await request.get("/api/auth/session")).json()).user).toBeTruthy();
  } finally { await settings.close(); }
});

test("sign-out lets users keep drafts or explicitly clear them without touching other accounts", async ({ page, request }) => {
  const owner = (await (await request.get("/api/auth/session")).json()).user.id;
  await page.goto("/dashboard"); await seed(page, owner);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Drafts on this device" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await dialog.getByRole("button", { name: "Keep drafts and sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await stored(page, owner)).mine).toHaveLength(1);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await dialog.getByRole("button", { name: "Clear drafts and sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await stored(page, owner)).toEqual({ mine: [], other: true, message: null, otherMessage: "other account message", unrelated: "keep" });
  expect((await page.request.get("/api/customers")).status()).toBe(401);
});
