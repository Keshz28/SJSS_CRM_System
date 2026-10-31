ALTER TABLE "projects" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "projects_companyId_deletedAt_idx" ON "projects"("companyId", "deletedAt");
CREATE TABLE "project_preferences" (
  "userId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "isPinned" BOOLEAN NOT NULL DEFAULT false,
  "isStarred" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "project_preferences_pkey" PRIMARY KEY ("userId", "projectId"),
  CONSTRAINT "project_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "project_preferences_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
