-- Local snooze for inbox items. The foyer query filters out rows where
-- snoozed_until > now(), so items naturally re-surface once the timestamp
-- passes. We do not call Gmail's native snooze API because (a) it
-- requires user-facing chooser parity we don't want to maintain and
-- (b) keeping snooze local means it works the same way for non-Gmail
-- sources we add later (Outlook, Slack, calendar invites).

ALTER TABLE "inbox_items"
  ADD COLUMN IF NOT EXISTS "snoozed_until" timestamp with time zone;
--> statement-breakpoint
-- Partial index — we only ever scan WHERE snoozed_until > now(), so
-- skip rows where the column is null (the common case). Keeps the
-- index small and write-cheap.
CREATE INDEX IF NOT EXISTS "inbox_items_snoozed_idx"
  ON "inbox_items" ("snoozed_until")
  WHERE "snoozed_until" IS NOT NULL;
