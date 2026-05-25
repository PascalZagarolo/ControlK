-- Resend tracking on workspace invites. last_sent_at is updated on
-- create AND on every resend; resent_count is incremented only by
-- resends (creation leaves it at 0). Together they support the
-- rate-limit rule in lib/actions/workspace.ts → resendInvite
-- (max 3 resends, min 5 minutes between).
ALTER TABLE "workspace_invites"
  ADD COLUMN IF NOT EXISTS "last_sent_at" timestamp with time zone;
ALTER TABLE "workspace_invites"
  ADD COLUMN IF NOT EXISTS "resent_count" integer NOT NULL DEFAULT 0;

-- Backfill existing rows so the new not-null behavior on last_sent_at
-- has sensible data. Set to created_at — the original send moment.
UPDATE "workspace_invites"
  SET "last_sent_at" = "created_at"
  WHERE "last_sent_at" IS NULL;
