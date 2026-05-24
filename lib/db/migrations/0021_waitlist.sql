-- Marketing landing waitlist. Standalone table — no FK to workspaces or
-- users, since people sign up before they've created either. ip_hash is
-- a SHA-256 prefix used only for rate-limiting so we don't store raw
-- addresses. source is whatever utm_source / referrer we captured.

CREATE TABLE IF NOT EXISTS "waitlist_signups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "source" text,
  "ip_hash" varchar(32),
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "waitlist_email_idx" ON "waitlist_signups" (lower("email"));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "waitlist_iphash_idx" ON "waitlist_signups" ("ip_hash", "created_at");
