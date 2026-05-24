-- Double Opt-In for the marketing waitlist (DSGVO requirement for DE).
-- confirm_token: random opaque string, set on signup, cleared on confirmation
--                so a leaked token can't be reused to flip the flag back.
-- token_sent_at: when the confirmation mail was dispatched — used to drive
--                expiry and to gate re-send attempts.
-- confirmed_at:  null = pending opt-in, set = user clicked the link.

ALTER TABLE "waitlist_signups"
  ADD COLUMN IF NOT EXISTS "confirm_token" varchar(64),
  ADD COLUMN IF NOT EXISTS "token_sent_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "confirmed_at" timestamp with time zone;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "waitlist_token_idx" ON "waitlist_signups" ("confirm_token");
