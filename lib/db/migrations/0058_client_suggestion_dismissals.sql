-- Auto-Kunden-VORSCHLAG (kein Auto-Tag): wenn der Nutzer einen Vorschlag
-- ablehnt ("nicht als Kunde"), merken wir uns das, damit er nicht wieder
-- vorgeschlagen wird. Per-User, identifier = lowercased Email/Domain.

CREATE TABLE IF NOT EXISTS "client_suggestion_dismissals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "user_id" varchar(255) NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "identifier" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "client_suggestion_dismissals_ws_user_identifier_idx"
  ON "client_suggestion_dismissals" ("workspace_id", "user_id", "identifier");
