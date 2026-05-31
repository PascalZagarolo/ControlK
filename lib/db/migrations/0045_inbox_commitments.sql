-- Promise Tracker: commitments the user made in their own SENT mails,
-- AI-extracted from the bodies. `inbox_items.commitments_scanned_at` marks
-- which sent items were already processed so Gmail bodies are never
-- re-fetched. Linked to the recipient's customer when resolvable.

ALTER TABLE "inbox_items"
  ADD COLUMN IF NOT EXISTS "commitments_scanned_at" timestamp with time zone;

CREATE TYPE "public"."commitment_status" AS ENUM ('open', 'done', 'dismissed');

CREATE TABLE IF NOT EXISTS "inbox_commitments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "user_id" varchar(255) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "source_item_id" uuid REFERENCES "inbox_items"("id") ON DELETE SET NULL,
  "source_thread_id" text,
  "recipient_email" text,
  "recipient_name" text,
  "customer_id" uuid REFERENCES "customers"("id") ON DELETE SET NULL,
  "promise_text" text NOT NULL,
  "due_at" timestamp with time zone,
  "status" "commitment_status" NOT NULL DEFAULT 'open',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "inbox_commitments_open_idx"
  ON "inbox_commitments" ("workspace_id", "user_id", "status", "due_at");
