import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { signUploadTicket, verifyUploadTicket } from "../lib/upload-ticket";
import { readRequestBytes } from "../lib/request-body";
import { readUploadForm } from "../lib/upload-form";
import { storeFile } from "../lib/file-storage";
import { signedDownload } from "../lib/cloud-storage";

const originalEnv = { ...process.env };
const realFetch = globalThis.fetch;
test.beforeEach(() => {
  process.env.NEXTAUTH_SECRET = "test-signing-key-".repeat(4);
  process.env.FILE_STORAGE = "supabase";
  process.env.SUPABASE_URL = "https://storage.example.invalid";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test-only";
  process.env.SUPABASE_STORAGE_BUCKET = "crm-files";
  process.env.SUPABASE_UPLOAD_BUCKET = "crm-pending";
});
test.afterEach(() => {
  globalThis.fetch = realFetch;
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
});
function ticket(overrides = {}) {
  return { userId: "owner", purpose: "attachment" as const, key: `pending/${randomUUID()}`, name: "image.png", type: "image/png", size: 12, metadata: { siteVisitId: "visit-1", clientUploadId: randomUUID() }, expires: Date.now() + 60000, ...overrides };
}
test("upload capabilities reject tampering, wrong users, wrong endpoints and expiry", () => {
  const value = ticket(), signed = signUploadTicket(value);
  expect(verifyUploadTicket(signed, "owner", "attachment")).toEqual(value);
  expect(() => verifyUploadTicket(signed, "someone-else", "attachment")).toThrow();
  expect(() => verifyUploadTicket(signed, "owner", "import")).toThrow();
  expect(() => verifyUploadTicket(signUploadTicket(ticket({ expires: Date.now() - 1 })), "owner", "attachment")).toThrow();
  const [payload, signature] = signed.split(".");
  const altered = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), metadata: { siteVisitId: "someone-elses-visit" } })).toString("base64url");
  expect(() => verifyUploadTicket(`${altered}.${signature}`, "owner", "attachment")).toThrow();
  expect(() => verifyUploadTicket(`${signed}.extra`, "owner", "attachment")).toThrow();
});
test("oversized streamed storage responses are rejected even without Content-Length", async () => {
  const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(12)); controller.enqueue(new Uint8Array(12)); controller.close(); } }));
  await expect(readRequestBytes(response, 16)).rejects.toThrow("Body too large");
});
test("hosted finalization validates bytes and writes a new immutable private key", async () => {
  const value = ticket(), calls: { url: string; method: string; body: unknown }[] = [];
  const bytes = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); calls.push({ url, method: init?.method || "GET", body: init?.body });
    if (url.endsWith("?token=test")) return new Response(bytes);
    if (url.includes("/object/sign/crm-pending/")) return Response.json({ signedURL: "/object/sign/crm-pending/test?token=test" });
    if (init?.method === "DELETE") return Response.json([]);
    if (url.includes("/object/crm-files/")) { expect(new Headers(init?.headers).get("x-upsert")).toBe("false"); return Response.json({ Key: "private-file" }); }
    if (url.includes("/object/sign/crm-files/")) return Response.json({ signedURL: "/object/sign/crm-files/test?token=read" });
    throw new Error("Unexpected storage call");
  }) as typeof fetch;
  const form = await readUploadForm(new Request("https://crm.example/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uploadTicket: signUploadTicket(value), siteVisitId: "forged" }) }), "owner", "attachment");
  expect(form.get("siteVisitId")).toBe("visit-1");
  const stored = await storeFile(form.get("file") as File);
  expect(stored.filepath).toMatch(/^supabase\/[0-9a-f-]+\.png$/);
  expect(stored.filepath).not.toContain(value.key);
  expect(stored.filesize).toBe(12);
  expect(await signedDownload(stored.filepath)).toContain("token=read");
  expect(calls.filter((call) => call.method === "POST" && call.url.includes("/object/crm-files/"))).toHaveLength(1);
});
test("invalid uploaded content never becomes a permanent attachment", async () => {
  globalThis.fetch = (async (input: RequestInfo | URL) => String(input).includes("?token=") ? new Response(new Uint8Array(12)) : Response.json({ signedURL: "/object/sign/crm-pending/test?token=test" })) as typeof fetch;
  await expect(readUploadForm(new Request("https://crm.example/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uploadTicket: signUploadTicket(ticket()) }) }), "owner", "attachment")).rejects.toThrow("content does not match");
});
test("Vercel never silently falls back to local disk", async () => {
  delete process.env.FILE_STORAGE; process.env.VERCEL = "1";
  await expect(storeFile(new File(["%PDF-test"], "test.pdf", { type: "application/pdf" }))).rejects.toThrow("Vercel requires");
});
