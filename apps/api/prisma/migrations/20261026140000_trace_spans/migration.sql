-- AlterTable
ALTER TABLE "WebhookDelivery" ADD COLUMN     "traceId" TEXT;

-- CreateTable
CREATE TABLE "TraceSpan" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "offsetMs" DOUBLE PRECISION NOT NULL,
    "durationMs" DOUBLE PRECISION,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TraceSpan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TraceSpan_practiceId_traceId_idx" ON "TraceSpan"("practiceId", "traceId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_traceId_idx" ON "WebhookDelivery"("traceId");

-- AddForeignKey
ALTER TABLE "TraceSpan" ADD CONSTRAINT "TraceSpan_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

