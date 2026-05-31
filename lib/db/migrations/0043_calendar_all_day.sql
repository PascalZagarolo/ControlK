-- All-day flag for calendar events. All-day (and multi-day) events render in
-- a band above the time grid instead of on the hour scale. Additive +
-- idempotent; existing events default to timed (false).

ALTER TABLE "calendar_events"
  ADD COLUMN IF NOT EXISTS "all_day" boolean NOT NULL DEFAULT false;
