-- Schritt 5 — lightweight manual client tagging.
-- Per-user tag of an email OR a whole domain as a "client", optional display
-- name. Distinct from the workspace CRM (customers/customer_contacts): lighter,
-- per-user, record-free, domain-capable — so a user can mark a client straight
-- from a mail. The customer-centric inbox views treat a sender as a client when
-- EITHER a tag here OR a CRM contact matches. Strictly manual (no auto-guess).

CREATE TYPE "public"."contact_tag_kind" AS ENUM ('email', 'domain');

CREATE TABLE IF NOT EXISTS "contact_tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "user_id" varchar(255) NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "kind" "contact_tag_kind" NOT NULL,
  "identifier" text NOT NULL,
  "display_name" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- One tag per (user, identifier) — re-tagging updates rather than duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS "contact_tags_user_identifier_idx"
  ON "contact_tags" ("user_id", "identifier");

CREATE INDEX IF NOT EXISTS "contact_tags_lookup_idx"
  ON "contact_tags" ("workspace_id", "user_id", "kind");
