-- Universal inbox + Gmail sync cursor.
--
-- oauth_accounts gains two Gmail-specific columns for the History API
-- cursor. We keep them on oauth_accounts (rather than a sibling table)
-- because there's exactly one cursor per Google connection, and the
-- lifecycle is identical to the row that holds the refresh token.
--
-- inbox_items is the new universal inbox. Today it only ingests Gmail,
-- but the source_type enum + (source_type, source_id) dedup key make
-- adding Outlook / Slack / calendar invites a per-source sync function
-- away — no schema rework.

ALTER TABLE "oauth_accounts"
  ADD COLUMN IF NOT EXISTS "gmail_history_id" text,
  ADD COLUMN IF NOT EXISTS "gmail_synced_at" timestamp with time zone;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "inbox_source_type" AS ENUM (
    'email_gmail', 'email_outlook', 'slack', 'calendar_invite'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inbox_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "user_id" varchar(255) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "source_type" "inbox_source_type" NOT NULL,
  "source_id" text NOT NULL,
  "source_thread_id" text,
  "sender_name" text NOT NULL,
  "sender_email" text,
  "subject" text,
  "preview" text,
  "received_at" timestamp with time zone NOT NULL,
  "is_read" boolean DEFAULT false NOT NULL,
  "is_archived" boolean DEFAULT false NOT NULL,
  "archived_at" timestamp with time zone,
  "related_entity_type" varchar(32),
  "related_entity_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inbox_items_source_dedup_idx"
  ON "inbox_items" ("source_type", "source_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inbox_items_workspace_list_idx"
  ON "inbox_items" ("workspace_id", "received_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inbox_items_unread_idx"
  ON "inbox_items" ("workspace_id", "is_read", "is_archived");
