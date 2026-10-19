// Explicitly preloaded by test:server. Not imported by application code/builds.
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
try { process.loadEnvFile(".env"); } catch { /* Environment may be injected. */ }
const local = (value) => ["localhost", "127.0.0.1"].includes(new URL(value).hostname);
if (!local(process.env.NEXTAUTH_URL) || !local(process.env.DATABASE_URL) || process.env.RESEND_API_KEY !== "local-test-only")
  throw new Error("Mock email is restricted to the isolated local test server.");
const root = path.resolve(".local/test-email-outbox");
await mkdir(root, { recursive: true, mode: 0o700 });
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url !== "https://api.resend.com/emails") return originalFetch(input, init);
  const data = JSON.parse(String(init?.body));
  const id = new Headers(init?.headers).get("Idempotency-Key");
  if (!/^[0-9a-f-]{36}$/i.test(id || "")) throw new Error("Invalid test challenge ID");
  const failure = path.join(root, `fail-${createHash("sha256").update(data.to[0]).digest("hex")}`);
  try { await access(failure); return new Response("{}", { status: 503 }); } catch { /* Normal delivery. */ }
  await writeFile(path.join(root, `${id}.json`), JSON.stringify(data), { mode: 0o600 });
  return Response.json({ id });
};
