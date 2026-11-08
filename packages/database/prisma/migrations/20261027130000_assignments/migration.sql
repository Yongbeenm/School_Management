CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'LATE', 'GRADED');

CREATE TABLE "Assignment" (
  "id" UUID NOT NULL, "schoolId" UUID NOT NULL, "teachingAssignmentId" UUID NOT NULL,
  "title" TEXT NOT NULL, "description" TEXT, "dueAt" TIMESTAMP(3) NOT NULL, "maxScore" DOUBLE PRECISION NOT NULL,
  "attachmentDocumentId" UUID, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssignmentSubmission" (
  "id" UUID NOT NULL, "assignmentId" UUID NOT NULL, "studentId" UUID NOT NULL, "content" TEXT,
  "attachmentDocumentId" UUID, "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED', "score" DOUBLE PRECISION, "feedback" TEXT,
  "gradedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssignmentSubmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Assignment_schoolId_dueAt_idx" ON "Assignment"("schoolId", "dueAt");
CREATE INDEX "Assignment_teachingAssignmentId_dueAt_idx" ON "Assignment"("teachingAssignmentId", "dueAt");
CREATE UNIQUE INDEX "AssignmentSubmission_assignmentId_studentId_key" ON "AssignmentSubmission"("assignmentId", "studentId");
CREATE INDEX "AssignmentSubmission_studentId_status_idx" ON "AssignmentSubmission"("studentId", "status");
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_teachingAssignmentId_fkey" FOREIGN KEY ("teachingAssignmentId") REFERENCES "TeachingAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
