ALTER TABLE "users" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
CREATE TABLE "email_login_challenges" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "sessionVersion" INTEGER NOT NULL
);
CREATE INDEX "email_login_challenges_expiresAt_idx" ON "email_login_challenges"("expiresAt");
