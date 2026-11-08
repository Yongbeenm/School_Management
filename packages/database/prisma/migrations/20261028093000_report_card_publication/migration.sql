-- Existing generated report cards were already visible in Version 2; retain that
-- behaviour by marking them published during the additive migration.
CREATE TYPE "ReportCardStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'APPROVED');

ALTER TABLE "ReportCard"
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "status" "ReportCardStatus" NOT NULL DEFAULT 'DRAFT';

UPDATE "ReportCard"
SET "status" = 'PUBLISHED', "publishedAt" = "generatedAt";
