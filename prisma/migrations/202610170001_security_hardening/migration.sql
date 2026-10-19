CREATE TABLE "login_buckets" (
  "key" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "login_buckets_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "login_buckets_expiresAt_idx" ON "login_buckets"("expiresAt");

CREATE TABLE "invoice_sequences" (
  "year" INTEGER NOT NULL,
  "value" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "invoice_sequences_pkey" PRIMARY KEY ("year")
);
-- Preserve numbering of historical invoices and never reuse a deleted number.
INSERT INTO "invoice_sequences" ("year", "value")
SELECT substring("invoiceNumber" from '^INV-([0-9]{4})-')::integer,
       max(substring("invoiceNumber" from '-([0-9]+)$')::integer)
FROM "quotations" WHERE "invoiceNumber" ~ '^INV-[0-9]{4}-[0-9]+$'
GROUP BY 1;
