CREATE TABLE "work_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "companyId" TEXT NOT NULL,
    "projectId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "work_groups_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "work_group_members" (
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "work_group_members_pkey" PRIMARY KEY ("groupId", "userId")
);
CREATE TABLE "work_group_messages" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isAnnouncement" BOOLEAN NOT NULL DEFAULT false,
    "clientRequestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "work_group_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "work_groups_companyId_updatedAt_idx" ON "work_groups"("companyId", "updatedAt");
CREATE INDEX "work_groups_projectId_idx" ON "work_groups"("projectId");
CREATE INDEX "work_group_members_userId_idx" ON "work_group_members"("userId");
CREATE UNIQUE INDEX "work_group_messages_clientRequestId_key" ON "work_group_messages"("clientRequestId");
CREATE INDEX "work_group_messages_groupId_createdAt_id_idx" ON "work_group_messages"("groupId", "createdAt", "id");
CREATE INDEX "work_group_messages_groupId_isAnnouncement_createdAt_idx" ON "work_group_messages"("groupId", "isAnnouncement", "createdAt");
ALTER TABLE "work_groups" ADD CONSTRAINT "work_groups_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_groups" ADD CONSTRAINT "work_groups_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "work_groups" ADD CONSTRAINT "work_groups_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "work_group_members" ADD CONSTRAINT "work_group_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "work_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_group_members" ADD CONSTRAINT "work_group_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_group_messages" ADD CONSTRAINT "work_group_messages_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "work_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_group_messages" ADD CONSTRAINT "work_group_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
