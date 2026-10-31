import { readFile, stat } from "node:fs/promises";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";

export async function cloudEnvironment() {
  const info = await stat(".env.launch");
  if (info.mode & 0o077) throw new Error("Keep .env.launch private: chmod 600 .env.launch");
  const env = parseEnv(await readFile(".env.launch", "utf8"));
  if (env.FILE_STORAGE !== "supabase" || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(env.SUPABASE_URL || "")) throw new Error("Configure the hosted project in .env.launch.");
  return env;
}
export function cloudClient(env) {
  if (!env.SUPABASE_SECRET_KEY) throw new Error("Add SUPABASE_SECRET_KEY privately to .env.launch.");
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function cloudDatabase(env) {
  const url = new URL(env.DIRECT_URL || "https://missing.invalid");
  const ref = new URL(env.SUPABASE_URL).hostname.split(".")[0];
  const direct = url.hostname === `db.${ref}.supabase.co`;
  const session = url.hostname.endsWith(".pooler.supabase.com") && decodeURIComponent(url.username) === `postgres.${ref}`;
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.password || (!direct && !session) || url.port === "6543") throw new Error("DIRECT_URL must be this project's direct or Session pooler PostgreSQL URI with its password.");
  url.searchParams.set("sslmode", "require");
  return url;
}
