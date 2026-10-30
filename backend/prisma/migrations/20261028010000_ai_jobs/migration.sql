CREATE TABLE "AiJob" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "ownerId" TEXT NOT NULL,
 "input" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'QUEUED',
 "phase" TEXT NOT NULL DEFAULT 'Waiting',
 "recipeId" TEXT,
 "error" TEXT,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "AiJob_status_createdAt_idx" ON "AiJob"("status", "createdAt");
CREATE INDEX "AiJob_ownerId_idx" ON "AiJob"("ownerId");
