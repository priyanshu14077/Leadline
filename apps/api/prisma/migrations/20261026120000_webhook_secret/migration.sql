-- Static API key replaced by a per-practice HMAC secret. Rename keeps the unique index.
ALTER TABLE "Practice" RENAME COLUMN "webhookKey" TO "webhookSecret";
ALTER INDEX "Practice_webhookKey_key" RENAME TO "Practice_webhookSecret_key";
