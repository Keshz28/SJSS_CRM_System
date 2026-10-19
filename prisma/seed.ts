import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { passwordSchema } from "../lib/password-policy";

const prisma = new PrismaClient();

async function main() {
  const demo = process.env.SEED_DEMO_DATA === "true";
  const localHost = new URL(process.env.DATABASE_URL || "postgresql://invalid").hostname;
  if (demo && (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "::1", "[::1]"].includes(localHost)))
    throw new Error("Demo seeding is allowed only on a local development database.");
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() || (demo ? "admin@sjss.com" : "");
  const password = process.env.SEED_ADMIN_PASSWORD || (demo ? "admin123" : "");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (!demo && !passwordSchema.safeParse(password).success))
    throw new Error("Set SEED_ADMIN_EMAIL and a strong SEED_ADMIN_PASSWORD (15 characters, at most 72 UTF-8 bytes). Use SEED_DEMO_DATA=true only for local development.");
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Administrator",
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log("✅ Admin user created:", admin.email);
  if (demo) console.log("Local demo accounts enabled. Never deploy their known passwords.");

  // ── Placeholder staff users (rename / change passwords in Admin → Users) ──
  const userPasswordHash = await bcrypt.hash("user123", 12);
  for (let i = 1; demo && i <= 4; i++) {
    const user = await prisma.user.upsert({
      where: { email: `user${i}@sjss.com` },
      update: {},
      create: {
        email: `user${i}@sjss.com`,
        name: `Staff User ${i}`,
        passwordHash: userPasswordHash,
        role: "USER",
      },
    });
    console.log(`✅ Staff user ready: ${user.email}`);
  }

  // ── Companies ──────────────────────────────────────────────────────────
  const sunrise = await prisma.company.upsert({
    where: { prefix: "SJSS" },
    update: {},
    create: {
      prefix: "SJSS",
      name: "SJ Sunrise Services",
      legalName: "SJ Sunrise Services",
      tagline: "Professional Services",
    },
  });
  console.log(`✅ Company ready: ${sunrise.name} (${sunrise.prefix})`);

  const sinarJasa = await prisma.company.upsert({
    where: { prefix: "SJ" },
    update: {},
    create: {
      prefix: "SJ",
      name: "Sinar Jasa Trading",
      legalName: "Sinar Jasa Trading",
      tagline: "Trading",
    },
  });
  console.log(`✅ Company ready: ${sinarJasa.name} (${sinarJasa.prefix})`);

  if (!demo) return;
  // Local sample records only. Production seeding never assigns legacy business data.
  const backfilled = await prisma.quotation.updateMany({
    where: { companyId: null },
    data: { companyId: sunrise.id },
  });
  if (backfilled.count > 0) {
    console.log(
      `✅ Assigned ${backfilled.count} existing quotation(s) to ${sunrise.name}`
    );
  }

  // Sample customer belonging to SJ Sunrise Services
  const customer = await prisma.customer.upsert({
    where: { id: "sample-customer-001" },
    update: {},
    create: {
      id: "sample-customer-001",
      companyId: sunrise.id,
      name: "ABC Trading Sdn Bhd",
      contactPerson: "Ahmad bin Hassan",
      email: "ahmad@abctrading.com",
      phone: "+60 12-345 6789",
      address: "No. 1, Jalan Bukit Bintang",
      city: "Kuala Lumpur",
    },
  });

  console.log("✅ Sample customer created:", customer.name);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
