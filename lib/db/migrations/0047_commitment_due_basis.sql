-- Promise Tracker — persist due_date_basis (Schritt 3, Prompt 3).
-- The extractor now resolves relative deadlines ("bis Freitag") against the
-- mail's SEND date and keeps the verbatim phrase it derived the date from.
-- Storing it powers deadline-explainability and lets us audit/repair a date
-- later without re-running the model. Nullable: many commitments have no
-- deadline, and all existing rows predate this column.

ALTER TABLE "inbox_commitments"
  ADD COLUMN IF NOT EXISTS "due_basis" text;
