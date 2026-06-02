-- Kundenmanagement (Kunden-Übersicht, Wedge): optionale Kurznotiz pro
-- getaggtem Kunden. Reitet auf der bestehenden, PER-USER contact_tags-Tabelle
-- (Prompt 5) — KEINE zweite Kunden-Datenstruktur, KEINE CRM-Felder.
-- Die Notiz ist die EINZIGE freiwillige manuelle Eingabe der Übersicht;
-- alle Kennzahlen (offene Zusagen, Wartezeit, letzte Interaktion) werden aus
-- vorhandenen Daten BERECHNET, nicht gepflegt.
-- Additiv + nullable; bestehende Tags bleiben unverändert.

ALTER TABLE "contact_tags" ADD COLUMN IF NOT EXISTS "note" text;
