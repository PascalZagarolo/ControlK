-- Direction + reply-tracking on inbox_items.
--
-- direction: 'inbox' for incoming, 'sent' for outgoing — same table,
-- different role. Default 'inbox' so the backfill is a no-op for
-- existing rows (all were inbox by design).
--
-- awaits_their_reply: cached flag, recomputed at the end of each sync
-- pass. True iff the row is a sent message with no newer messages in
-- the same thread from anyone other than the user. Powers the
-- "Du wartest auf …" column without per-render thread scans.
--
-- recipient_email: who we sent it to. NULL for inbox rows. Only the
-- first recipient is captured — multi-recipient threads still resolve
-- to a single "person you're waiting on" by convention.

DO $$ BEGIN
  CREATE TYPE "inbox_direction" AS ENUM ('inbox', 'sent');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
ALTER TABLE "inbox_items"
  ADD COLUMN IF NOT EXISTS "direction" "inbox_direction" NOT NULL DEFAULT 'inbox',
  ADD COLUMN IF NOT EXISTS "awaits_their_reply" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "recipient_email" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inbox_items_awaiting_idx"
  ON "inbox_items" ("workspace_id", "direction", "awaits_their_reply", "received_at");
