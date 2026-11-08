CREATE TYPE "NotificationType" AS ENUM ('ASSIGNMENT', 'SUBMISSION_GRADED', 'EXAM', 'RESULT', 'ANNOUNCEMENT', 'ATTENDANCE', 'GENERAL');
CREATE TABLE "Notification" ("id" UUID NOT NULL, "userId" UUID NOT NULL, "title" TEXT NOT NULL, "message" TEXT NOT NULL, "type" "NotificationType" NOT NULL DEFAULT 'GENERAL', "referenceType" TEXT, "referenceId" TEXT, "isRead" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "readAt" TIMESTAMP(3), CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"));
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId","isRead","createdAt");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
