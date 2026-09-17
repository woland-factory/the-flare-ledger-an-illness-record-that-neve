-- The covenant nudge is recorded once per flare, so a forgotten open flare is
-- surfaced at most one time and never again. Null means "not yet nudged"; a
-- timestamp means "nudged, never again". Forward-only and additive: no change
-- to treatments or any other table.

-- AlterTable
ALTER TABLE "flares" ADD COLUMN "nudged_at" TIMESTAMPTZ(6);
