-- Wochen-Rückblick: Zeitpunkt, an dem eine Zusage 'open' verlassen hat
-- (done ODER dismissed). Treibt "diese Woche gehalten". Additiv, nullable.

ALTER TABLE "inbox_commitments" ADD COLUMN IF NOT EXISTS "resolved_at" timestamp with time zone;
