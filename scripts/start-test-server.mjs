import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";
process.loadEnvFile(".env");
for (const value of [process.env.NEXTAUTH_URL, process.env.DATABASE_URL]) {
  if (!["localhost", "127.0.0.1"].includes(new URL(value).hostname)) throw new Error("The test server requires a local app AND local database.");
}
const preload = pathToFileURL(path.resolve("tests/helpers/mock-email.mjs")).href;
console.log("Starting local production test server with fake email delivery; no real email is sent.");
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1"], {
  stdio: "inherit",
  env: { ...process.env, NODE_OPTIONS: `--import=${preload}`, RESEND_API_KEY: "local-test-only", AUTH_EMAIL_FROM: "SJSS Test <test@example.invalid>" },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => { process.exitCode = code || 0; });
