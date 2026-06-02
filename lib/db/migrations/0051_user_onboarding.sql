-- Onboarding (Erst-Flow nach Anmeldung).
-- onboarding_focus: die gewählte AUFGABE aus Schritt 1 (nicht Identität) —
--   personalisiert nur Messaging, segmentiert KEINE Feature-Sets.
-- onboarding_completed_at: gated den /onboarding-Redirect.
-- workspace_type (solo|team) wird auf der BESTEHENDEN Spalte workspaces.scope
--   abgebildet (private=solo / business=team) — keine Duplikat-Spalte; scope
--   gated bereits die Team-Elemente. Daher hier nur die zwei User-Felder.
-- Beide nullable + additiv; bestehende User bleiben unverändert (Onboarding
--   gilt für sie als nicht offen → kein Redirect, siehe Backfill unten).

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_focus" varchar(32);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_completed_at" timestamp with time zone;

-- Backfill: bestehende Accounts haben das Produkt schon im Gebrauch — sie
-- sollen NICHT plötzlich ins Onboarding umgeleitet werden. Als abgeschlossen
-- markieren. Neue Accounts starten mit NULL → durchlaufen den Flow.
UPDATE "users" SET "onboarding_completed_at" = now() WHERE "onboarding_completed_at" IS NULL;
