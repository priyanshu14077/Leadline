-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('META', 'GOOGLE', 'TIKTOK');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('META_LEAD_ADS', 'GOOGLE_LEAD_FORM', 'WEBSITE');

-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('NEW', 'CONTACTED', 'CONSULT_BOOKED', 'TREATMENT_ACCEPTED', 'LOST');

-- CreateEnum
CREATE TYPE "TriageStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "Treatment" AS ENUM ('IMPLANTS', 'INVISALIGN', 'VENEERS', 'WHITENING', 'COMPOSITE_BONDING', 'OTHER');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "Objection" AS ENUM ('PRICE', 'FEAR', 'TIME', 'TRUST', 'OTHER');

-- CreateEnum
CREATE TYPE "DeliveryOutcome" AS ENUM ('CREATED', 'DUPLICATE', 'REJECTED');

-- CreateTable
CREATE TABLE "Practice" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "webhookKey" TEXT NOT NULL,

    CONSTRAINT "Practice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "utmCampaign" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spendPence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "source" "LeadSource" NOT NULL,
    "sourceLeadId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "message" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmCampaign" TEXT,
    "campaignId" TEXT,
    "stage" "Stage" NOT NULL DEFAULT 'NEW',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstContactedAt" TIMESTAMP(3),
    "consultBookedAt" TIMESTAMP(3),
    "treatmentAcceptedAt" TIMESTAMP(3),
    "treatmentValuePence" INTEGER,
    "triageStatus" "TriageStatus" NOT NULL DEFAULT 'PENDING',
    "treatmentInterest" "Treatment",
    "urgency" "Urgency",
    "objections" "Objection"[],
    "triageOpener" TEXT,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceLeadId" TEXT,
    "outcome" "DeliveryOutcome" NOT NULL,
    "leadId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Practice_slug_key" ON "Practice"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Practice_webhookKey_key" ON "Practice"("webhookKey");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_practiceId_utmCampaign_key" ON "Campaign"("practiceId", "utmCampaign");

-- CreateIndex
CREATE INDEX "Lead_practiceId_stage_receivedAt_idx" ON "Lead"("practiceId", "stage", "receivedAt");

-- CreateIndex
CREATE INDEX "Lead_campaignId_idx" ON "Lead"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_practiceId_source_sourceLeadId_key" ON "Lead"("practiceId", "source", "sourceLeadId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_practiceId_receivedAt_idx" ON "WebhookDelivery"("practiceId", "receivedAt");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
