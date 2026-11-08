CREATE TYPE "FeeCurrency" AS ENUM ('USD', 'KHR');
CREATE TYPE "FeePaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD', 'OTHER');

CREATE TABLE "FeeCharge" (
  "id" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" "FeeCurrency" NOT NULL DEFAULT 'USD',
  "dueOn" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  CONSTRAINT "FeeCharge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FeeCharge_amount_positive" CHECK ("amount" > 0)
);

CREATE TABLE "FeePayment" (
  "id" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "chargeId" UUID NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "method" "FeePaymentMethod" NOT NULL,
  "reference" TEXT,
  "note" TEXT,
  "receivedOn" DATE NOT NULL,
  "idempotencyKey" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  CONSTRAINT "FeePayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FeePayment_amount_positive" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "FeeCharge_id_schoolId_key" ON "FeeCharge"("id", "schoolId");
CREATE INDEX "FeeCharge_schoolId_studentId_dueOn_idx" ON "FeeCharge"("schoolId", "studentId", "dueOn");
CREATE INDEX "FeeCharge_schoolId_dueOn_idx" ON "FeeCharge"("schoolId", "dueOn");
CREATE UNIQUE INDEX "FeePayment_idempotencyKey_key" ON "FeePayment"("idempotencyKey");
CREATE INDEX "FeePayment_schoolId_receivedOn_idx" ON "FeePayment"("schoolId", "receivedOn");
CREATE INDEX "FeePayment_chargeId_createdAt_idx" ON "FeePayment"("chargeId", "createdAt");

ALTER TABLE "FeeCharge" ADD CONSTRAINT "FeeCharge_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeCharge" ADD CONSTRAINT "FeeCharge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeePayment" ADD CONSTRAINT "FeePayment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeePayment" ADD CONSTRAINT "FeePayment_chargeId_schoolId_fkey" FOREIGN KEY ("chargeId", "schoolId") REFERENCES "FeeCharge"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
