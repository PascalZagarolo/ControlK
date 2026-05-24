-- Category bucket on inbox_items + per-domain AI topic cache.
--
-- inbox_category: deterministic classification written at sync time.
-- Priority order: customer match > shipping-domain > Gmail's
-- CATEGORY_* label > 'primary' default. Customer beats Promo because
-- a customer's marketing newsletter is still customer-relevant.
--
-- sender_topics: per-(workspace, domain) cache of the AI's topic
-- classification. Keyed on domain so we never re-classify the same
-- sender twice. source distinguishes ai-derived from a future manual
-- override surface.

DO $$ BEGIN
  CREATE TYPE "inbox_category" AS ENUM (
    'primary', 'customer', 'shipping', 'promo', 'social', 'updates', 'forums'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "sender_topic_source" AS ENUM ('ai', 'manual');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
ALTER TABLE "inbox_items"
  ADD COLUMN IF NOT EXISTS "category" "inbox_category" NOT NULL DEFAULT 'primary';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inbox_items_category_idx"
  ON "inbox_items" ("workspace_id", "category", "is_archived");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sender_topics" (
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "domain" varchar(253) NOT NULL,
  "topic" varchar(64) NOT NULL,
  "source" "sender_topic_source" NOT NULL DEFAULT 'ai',
  "classified_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sender_topics_pk"
  ON "sender_topics" ("workspace_id", "domain");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sender_topics_workspace_topic_idx"
  ON "sender_topics" ("workspace_id", "topic");
