import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@sjss.com" },
    update: {},
    create: {
      email: "admin@sjss.com",
      name: "Administrator",
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log("✅ Admin user created:", admin.email);
  console.log("   Password: admin123");
  console.log("   ⚠️  Change this password after first login!");

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

  // ── Backfill existing quotations → SJ Sunrise Services ───────────────────
  const backfilled = await prisma.quotation.updateMany({
    where: { companyId: null },
    data: { companyId: sunrise.id },
  });
  if (backfilled.count > 0) {
    console.log(
      `✅ Assigned ${backfilled.count} existing quotation(s) to ${sunrise.name}`
    );
  }

  // Sample customer (shared across both companies)
  const customer = await prisma.customer.upsert({
    where: { id: "sample-customer-001" },
    update: {},
    create: {
      id: "sample-customer-001",
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
