-- Manuell anlegbare Kontakte (telefonisch akquirierte Leads), nur in
-- Business-Workspaces. Erweitert die BESTEHENDE geteilte customers-Struktur —
-- keine zweite Kontakt-Datenstruktur. E-Mail-Adressen liegen weiterhin in
-- customer_contacts (Mehrfach-Adressen + Telefon bereits vorhanden); die
-- Mail-Rückführung läuft über die bestehende resolveClient-crm_contact-Logik.
--
-- source: 'manual' kennzeichnet handangelegte Kontakte (vs. Rental-CRM).
-- company/phone: optionale Kontaktdetails. contact_status: EIN freies
-- Status-Feld (frei wählbar) — KEINE Pipeline-/Stage-Tabelle, KEINE Automatik.
-- Alle Spalten additiv + nullable; bestehende customers bleiben unverändert.

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "source" text;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "company" text;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "contact_status" text;

-- The customer overview filters manual contacts by (workspace_id, source);
-- index it so large workspaces don't full-scan customers.
CREATE INDEX IF NOT EXISTS "customers_source_idx" ON "customers" ("workspace_id", "source");
