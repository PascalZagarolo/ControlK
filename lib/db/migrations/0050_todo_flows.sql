-- Todo-Flows — sequenzielle Abläufe ohne Termin.
-- Ein Flow ist ein Todo mit is_flow = true; seine SCHRITTE sind normale Todos
-- mit flow_parent_id → dem Flow. EINE Datenquelle, zwei Ansichten (Liste +
-- Graph). "aktiv" wird nicht gespeichert, sondern aus step_order berechnet
-- (erster offener Schritt). depends_on ist für spätere Verzweigung angelegt;
-- lineare Flows nutzen nur step_order. Alle Felder additiv + nullable —
-- bestehende Todos bleiben unverändert (is_flow default false).

ALTER TABLE "todos" ADD COLUMN IF NOT EXISTS "is_flow" boolean NOT NULL DEFAULT false;
ALTER TABLE "todos" ADD COLUMN IF NOT EXISTS "flow_parent_id" uuid;
ALTER TABLE "todos" ADD COLUMN IF NOT EXISTS "step_order" integer;
ALTER TABLE "todos" ADD COLUMN IF NOT EXISTS "depends_on" uuid;

-- A step belongs to its flow; deleting the flow removes its steps.
ALTER TABLE "todos"
  ADD CONSTRAINT "todos_flow_parent_id_fk"
  FOREIGN KEY ("flow_parent_id") REFERENCES "todos"("id") ON DELETE cascade;

-- Predecessor link (branch-ready). Clearing the predecessor just nulls it.
ALTER TABLE "todos"
  ADD CONSTRAINT "todos_depends_on_fk"
  FOREIGN KEY ("depends_on") REFERENCES "todos"("id") ON DELETE set null;

CREATE INDEX IF NOT EXISTS "todos_flow_idx" ON "todos" ("flow_parent_id", "step_order");
