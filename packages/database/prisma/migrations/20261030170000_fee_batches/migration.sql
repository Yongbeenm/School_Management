CREATE TABLE "FeeBatch" (
  "id" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "classSectionId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" "FeeCurrency" NOT NULL,
  "dueOn" DATE NOT NULL,
  "studentCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  CONSTRAINT "FeeBatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FeeBatch_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "FeeBatch_studentCount_positive" CHECK ("studentCount" > 0)
);

CREATE INDEX "FeeBatch_schoolId_createdAt_idx" ON "FeeBatch"("schoolId", "createdAt");
CREATE INDEX "FeeBatch_classSectionId_createdAt_idx" ON "FeeBatch"("classSectionId", "createdAt");
ALTER TABLE "FeeBatch" ADD CONSTRAINT "FeeBatch_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeBatch" ADD CONSTRAINT "FeeBatch_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "ClassSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FeeCharge" ADD COLUMN "batchId" UUID;
CREATE UNIQUE INDEX "FeeCharge_batchId_studentId_key" ON "FeeCharge"("batchId", "studentId");
ALTER TABLE "FeeCharge" ADD CONSTRAINT "FeeCharge_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "FeeBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
