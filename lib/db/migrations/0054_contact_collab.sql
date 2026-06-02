-- Kollaboratives Kundenmanagement (2-Personen-Team): geteilte Sichtbarkeit +
-- "wer hat was zuletzt gemacht". Erweitert die BESTEHENDE customers-Struktur,
-- KEIN neues System. "Wer zuletzt interagiert" wird aus Mail-Metadaten
-- BERECHNET, nicht gespeichert.
--
-- assigned_to: optionale, leichtgewichtige Zuständigkeit (ein Workspace-
--   Mitglied oder NULL = beide/niemand). EIN Feld, kein Workflow.
-- contact_notes: geteilte, chronologische Kurz-Updates (freiwillig, freitext).
--   KEINE Stage-/Activity-Type-/Pflicht-Tabellen.
-- Additiv; bestehende Daten bleiben unverändert.

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "assigned_to" varchar(255);

DO $$ BEGIN
  ALTER TABLE "customers"
    ADD CONSTRAINT "customers_assigned_to_users_id_fk"
    FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "contact_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE cascade,
  "author_id" varchar(255) REFERENCES "users"("id") ON DELETE set null,
  "text" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "contact_notes_customer_idx" ON "contact_notes" ("customer_id", "created_at");

-- Assignment lookups ("meine Kontakte") filter by (workspace, assignee).
CREATE INDEX IF NOT EXISTS "customers_assigned_to_idx" ON "customers" ("workspace_id", "assigned_to");
