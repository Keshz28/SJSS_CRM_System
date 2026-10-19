// Read-only pre-deployment checks. Never print connection strings or secrets.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import path from "node:path";
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
required(upload && path.isAbsolute(upload) && path.resolve(upload) !== publicRoot && !path.resolve(upload).startsWith(publicRoot + path.sep), "Configure UPLOAD_DIR on durable private storage outside public/.");
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
  const pending = await prisma.$queryRaw`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL`;
  required(pending.length === 0, "Resolve incomplete database migrations.");
  await prisma.loginBucket.count();
  await prisma.invoiceSequence.count();
  await prisma.emailLoginChallenge.count();
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
