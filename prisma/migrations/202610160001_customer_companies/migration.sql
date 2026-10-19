ALTER TABLE "customers" ADD COLUMN "companyId" TEXT;
CREATE INDEX "customers_companyId_isActive_idx" ON "customers"("companyId", "isActive");
ALTER TABLE "customers" ADD CONSTRAINT "customers_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve historical links. Shared customers become independent records for
-- each company they already worked with. Customers without history stay visibly
-- unassigned until someone chooses their company; never guess business ownership.
DO $$
DECLARE c RECORD; co RECORD; target_id TEXT; first_company BOOLEAN;
BEGIN
  FOR c IN SELECT * FROM "customers" LOOP
    first_company := TRUE;
    FOR co IN
      SELECT "companyId" FROM "quotations" WHERE "customerId" = c.id AND "companyId" IS NOT NULL
      UNION SELECT "companyId" FROM "site_visits" WHERE "customerId" = c.id
      UNION SELECT "companyId" FROM "projects" WHERE "customerId" = c.id
      ORDER BY "companyId"
    LOOP
      IF first_company THEN
        target_id := c.id;
        UPDATE "customers" SET "companyId" = co."companyId" WHERE id = c.id;
        first_company := FALSE;
      ELSE
        target_id := 'company_customer_' || md5(c.id || ':' || co."companyId");
        INSERT INTO "customers" (id, "companyId", name, "contactPerson", email, phone, address, city, notes, "isActive", "createdAt", "updatedAt")
        VALUES (target_id, co."companyId", c.name, c."contactPerson", c.email, c.phone, c.address, c.city, c.notes, c."isActive", c."createdAt", c."updatedAt");
      END IF;
      UPDATE "quotations" SET "customerId" = target_id WHERE "customerId" = c.id AND "companyId" = co."companyId";
      UPDATE "site_visits" SET "customerId" = target_id WHERE "customerId" = c.id AND "companyId" = co."companyId";
      UPDATE "projects" SET "customerId" = target_id WHERE "customerId" = c.id AND "companyId" = co."companyId";
    END LOOP;
  END LOOP;
END $$;
