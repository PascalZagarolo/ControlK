-- Promise Tracker — confidence threshold + explainability (Schritt 4a).
-- The extractor already produces a confidence (high/medium/low) and the
-- verbatim source sentence; we now persist both so the UI can (a) only treat
-- HIGH-confidence promises as hard "fällig" and show the rest as "mögliche
-- Zusage — bestätigen?", and (b) show the quote as the "warum ist das hier".
--
-- Existing rows predate confidence extraction. They default to 'medium' so
-- they surface as "bitte bestätigen" rather than being asserted as facts —
-- the conservative choice (a wrong "fällig" costs more trust than a soft one).

CREATE TYPE "public"."commitment_confidence" AS ENUM ('high', 'medium', 'low');

ALTER TABLE "inbox_commitments"
  ADD COLUMN IF NOT EXISTS "confidence" "commitment_confidence" NOT NULL DEFAULT 'medium';

ALTER TABLE "inbox_commitments"
  ADD COLUMN IF NOT EXISTS "source_quote" text;

-- Auto-done audit: when a later SENT mail in the same thread suggests the
-- promise was already fulfilled, we mark it done and stamp when/why so the
-- user can tell auto-resolved commitments from ones they closed by hand.
ALTER TABLE "inbox_commitments"
  ADD COLUMN IF NOT EXISTS "auto_done_at" timestamp with time zone;

-- Threshold-aware listing: open commitments filtered/ordered by confidence.
CREATE INDEX IF NOT EXISTS "inbox_commitments_confidence_idx"
  ON "inbox_commitments" ("workspace_id", "user_id", "status", "confidence");
