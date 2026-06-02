-- Web-Push-Subscriptions (Nudges): eine pro Browser/Gerät. Treibt den
-- täglichen Hinweis auf fällige/überfällige Zusagen + lange wartende Kunden.
-- Tote Endpoints (404/410 beim Senden) werden vom Sender entfernt.

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(255) NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "user_agent" text,
  "last_nudged_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_idx" ON "push_subscriptions" ("endpoint");
CREATE INDEX IF NOT EXISTS "push_subscriptions_user_idx" ON "push_subscriptions" ("user_id");
