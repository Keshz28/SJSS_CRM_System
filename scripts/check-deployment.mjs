// Read-only pre-deployment checks. Never print connection strings or secrets.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
try { process.loadEnvFile(".env"); } catch { /* Hosted environments inject variables. */ }
const failures = [];
const required = (condition, message) => { if (!condition) failures.push(message); };
let url;
try { url = new URL(process.env.NEXTAUTH_URL || ""); } catch { /* Report below. */ }
required(url?.protocol === "https:" && !["localhost", "127.0.0.1"].includes(url?.hostname), "Configure NEXTAUTH_URL with the final HTTPS domain.");
required((process.env.NEXTAUTH_SECRET || "").length >= 32, "Set a long, random NEXTAUTH_SECRET.");
required(process.env.RESEND_API_KEY && process.env.AUTH_EMAIL_FROM, "Configure administrator verification email delivery with RESEND_API_KEY and a verified AUTH_EMAIL_FROM sender.");
const upload = process.env.UPLOAD_DIR;
const publicRoot = path.resolve("public");
if (process.env.FILE_STORAGE === "supabase") {
  required(process.env.SUPABASE_URL?.startsWith("https://") && process.env.SUPABASE_SECRET_KEY, "Configure private Supabase Storage credentials.");
  required(process.env.SUPABASE_STORAGE_BUCKET && process.env.SUPABASE_UPLOAD_BUCKET && process.env.SUPABASE_STORAGE_BUCKET !== process.env.SUPABASE_UPLOAD_BUCKET, "Configure separate permanent and staging private buckets.");
  try {
    const storage = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
    for (const name of [process.env.SUPABASE_STORAGE_BUCKET, process.env.SUPABASE_UPLOAD_BUCKET]) {
      const { data, error } = await storage.getBucket(name);
      required(!error && data && !data.public && Number(data.file_size_limit) === 50 * 1024 * 1024, "Both Storage buckets must be private and enforce the 50 MB maximum.");
    }
  } catch { failures.push("Could not verify private Storage bucket settings."); }
  try {
    const database = new URL(process.env.DATABASE_URL);
    required(database.searchParams.get("sslmode") === "require", "Require TLS on the hosted database connection.");
    required(decodeURIComponent(database.username).split(".")[0] === "crm_runtime", "Use the restricted crm_runtime database login.");
  } catch { failures.push("Configure a valid hosted database URL."); }
} else {
  required(!process.env.VERCEL, "Vercel deployments require FILE_STORAGE=supabase; local disk is not durable.");
  required(upload && path.isAbsolute(upload) && path.resolve(upload) !== publicRoot && !path.resolve(upload).startsWith(publicRoot + path.sep), "Configure UPLOAD_DIR on durable private storage outside public/.");
}
const prisma = new PrismaClient();
try {
  const users = await prisma.user.findMany({ where: { isActive: true }, select: { passwordHash: true, role: true, email: true } });
  required(users.some((user) => user.role === "ADMIN"), "At least one active administrator is required.");
  let weak = 0;
  for (const user of users) {
    if (await bcrypt.compare("admin123", user.passwordHash) || await bcrypt.compare("user123", user.passwordHash)) weak++;
  }
  required(weak === 0, `${weak} active account(s) still use a known demo password. Reset or deactivate them before deployment.`);
  const demoEmails = ["admin@sjss.com", "user1@sjss.com", "user2@sjss.com", "user3@sjss.com", "user4@sjss.com"];
  required(!users.some((user) => demoEmails.includes(user.email.toLowerCase())), "Deactivate the demo accounts after a verified sign-in with the real administrator.");
  const roles = await prisma.$queryRaw`SELECT rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user`;
  required(roles.every((role) => !role.rolsuper && !role.rolcreatedb && !role.rolcreaterole), "Use a non-superuser runtime database role without role/database creation privileges.");
  // NextAuth is the only application identity system. Supabase's browser roles
  // must not gain a second path around the CRM server's permission checks.
  const browserRoles = await prisma.$queryRaw`SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')`;
  if (browserRoles.length) {
    const crmTables = ["users", "notifications", "companies", "customers", "quotations", "quotation_items", "attachments", "site_visits", "projects", "project_preferences", "work_groups", "work_group_members", "work_group_messages", "quotation_sequences", "login_buckets", "email_login_challenges", "invoice_sequences", "_prisma_migrations"];
    const tables = await prisma.$queryRaw`SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r'`;
    const privateTables = tables.filter((table) => crmTables.includes(table.relname));
    required(privateTables.every((table) => table.relrowsecurity), "Enable RLS on every CRM table before using a Supabase hosted database.");
    let browserAccess = false;
    for (const role of browserRoles) {
      for (const table of privateTables) {
        const [{ allowed }] = await prisma.$queryRaw`SELECT has_table_privilege(${role.rolname}::text, ${'public.' + table.relname}::text, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') AS allowed`;
        if (allowed) browserAccess = true;
      }
    }
    required(!browserAccess, "Revoke Supabase anon/authenticated role privileges on CRM tables; access must go through the authenticated CRM server.");
  }
  const pending = await prisma.$queryRaw`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL`;
  required(pending.length === 0, "Resolve incomplete database migrations.");
  await prisma.loginBucket.count();
  await prisma.invoiceSequence.count();
  await prisma.emailLoginChallenge.count();
  if (process.env.FILE_STORAGE === "supabase") required(await prisma.attachment.count({ where: { NOT: { filepath: { startsWith: "supabase/" } } } }) === 0, "Transfer and verify every local attachment before cloud launch.");
} catch {
  failures.push("Database checks failed. Verify connectivity, permissions and applied migrations.");
} finally { await prisma.$disconnect(); }
if (failures.length) {
  console.log("Not ready for deployment:");
  failures.forEach((failure) => console.log(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log("Automated deployment checks passed. Complete the hosting, access-policy and backup checks in SECURITY_REVIEW.md before publishing.");
}
