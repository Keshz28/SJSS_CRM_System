import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { cloudEnvironment, cloudDatabase } from "./cloud-env.mjs";
import { spawn } from "node:child_process";
let admin, runtime;
try {
  const env = await cloudEnvironment();
  const direct = cloudDatabase(env);
  admin = new PrismaClient({ datasources: { db: { url: direct.href } } });
  // Prisma's db execute supports multi-statement SQL, unlike prepared queries.
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["node_modules/prisma/build/index.js", "db", "execute", "--file", "scripts/cloud-hardening.sql", "--schema", "prisma/schema.prisma"], {
      env: { ...process.env, DATABASE_URL: direct.href, DIRECT_URL: direct.href }, stdio: "ignore",
    });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error("Hardening failed")));
  });
  let connection = env.DATABASE_URL;
  if (!connection) {
    const password = randomBytes(32).toString("hex");
    await admin.$executeRawUnsafe(`ALTER ROLE crm_runtime LOGIN PASSWORD '${password}'`);
    const url = new URL(direct.href);
    url.username = url.hostname.endsWith(".pooler.supabase.com") ? `crm_runtime.${new URL(env.SUPABASE_URL).hostname.split(".")[0]}` : "crm_runtime";
    url.password = password;
    if (url.hostname.endsWith(".pooler.supabase.com")) { url.port = "6543"; url.searchParams.set("pgbouncer", "true"); }
    url.searchParams.set("connection_limit", "1");
    connection = url.href;
    const source = await readFile(".env.launch", "utf8");
    await writeFile(".env.launch", source.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${connection}"`), { mode: 0o600 });
  }
  runtime = new PrismaClient({ datasources: { db: { url: connection } } });
  await runtime.customer.count();
  const [role] = await runtime.$queryRaw`SELECT current_user AS name, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user`;
  if (role.name !== "crm_runtime" || role.rolsuper || role.rolbypassrls || role.rolcreatedb || role.rolcreaterole) throw new Error("Unexpected runtime permissions.");
  console.log("Runtime database login configured and verified. Credentials remain in .env.launch.");
} catch { console.error("Cloud configuration failed. Check the private DIRECT_URL, project, migration owner permissions and connection. No secrets were printed."); process.exitCode = 1; }
finally { await admin?.$disconnect(); await runtime?.$disconnect(); }
