-- Opt-in "Vermietung/Business" pack toggle per workspace. Gates the
-- uRent-specific modules (Flotte, Verträge, Vermietungs-CRM + the rental
-- tools the AI agent can use) so the default Ctrl K experience is a
-- horizontal, Notion-like core. Off by default — existing workspaces keep
-- the clean core until they opt in.

ALTER TABLE "workspaces"
  ADD COLUMN IF NOT EXISTS "rental_pack" boolean NOT NULL DEFAULT false;
