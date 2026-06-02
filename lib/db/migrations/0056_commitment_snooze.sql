-- "Nicht heute" für Zusagen: eine Zusage kann auf später verschoben werden und
-- verschwindet bis dahin aus offener Liste + Morgen-Plan (taucht dann wieder
-- auf). Bisher war "nicht heute" für Zusagen ein No-Op (nur Client-Collapse).
-- Additiv + nullable.

ALTER TABLE "inbox_commitments" ADD COLUMN IF NOT EXISTS "snoozed_until" timestamp with time zone;
