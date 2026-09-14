-- Add optional free-text notes captured by the flare-end interview.
-- Forward-only and additive: both columns are nullable, so existing rows
-- (including the demo seed) remain valid with no backfill.

-- AlterTable
ALTER TABLE "flares" ADD COLUMN "impact_note" TEXT;
ALTER TABLE "flares" ADD COLUMN "symptom_note" TEXT;
