-- Todo-Verbesserung — eingeplante Uhrzeit als reines Datenfeld.
-- "HH:MM" lokale Wanduhr, kein Zeitzonen-Anker, KEINE Kalender-/Morgen-Plan-
-- Kopplung (bewusst ausgeklammert) — nur Feld + Anzeige. Nullable; alle
-- bestehenden Todos haben keine eingeplante Uhrzeit.

ALTER TABLE "todos"
  ADD COLUMN IF NOT EXISTS "scheduled_time" text;
