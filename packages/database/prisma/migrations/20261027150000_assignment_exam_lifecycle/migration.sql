-- Assignment and examination publication lifecycles, plus weighted exam subjects.
CREATE TYPE "AssignmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');
CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'COMPLETED', 'PUBLISHED', 'ARCHIVED');

ALTER TABLE "Assignment"
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "status" "AssignmentStatus" NOT NULL DEFAULT 'DRAFT';

ALTER TABLE "Exam"
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT';

ALTER TABLE "ExamSubject"
  ADD COLUMN "weight" DOUBLE PRECISION NOT NULL DEFAULT 1;
