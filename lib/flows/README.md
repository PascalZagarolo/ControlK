# Todo-Flows (`lib/flows`)

Sequenzielle Abläufe ohne Termin („erst A, dann B, dann C") mit zwei
Ansichten auf **derselben** Datenquelle: **Liste** (Default, Pflicht-Basis)
und **Flow-Chart** (Knoten + Pfeile, horizontal L→R). Erweitert die bestehende
Todo-Funktion — kein paralleles System, keine Automatisierung/Ausführung (nur
die visuelle Knoten-Metapher).

## USP — Sequenz-Logik aus Abhängigkeiten

Der Mehrwert ggü. einer flachen Liste ist „**was kann ich JETZT tun**":
- **AKTIV** = nicht erledigt UND alle Vorgänger erledigt.
- **WARTET** = nicht erledigt, aber ein Vorgänger noch offen (blockiert,
  gedämpft).
- Wird der aktive Schritt erledigt, wird der nächste entsperrte automatisch
  aktiv — rein aus den Daten berechnet (`lib/flows/sequence.ts` `resolveFlow`),
  kein gespeichertes „aktiv"-Flag.
- `depends_on` treibt die Blockierung; ohne expliziten Wert = linearer
  Vorgänger (vorheriger Schritt in `step_order`). **Branch-ready**: mehrere
  Schritte mit erledigtem Vorgänger sind gleichzeitig aktiv.

## Zentrale Status-Tokens

`lib/flows/status.ts` (`FLOW_STATUS`, `FLOW_EDGE`, `FLOW_CANVAS_BG`) ist die
**eine** Quelle für Farbe + Label je Zustand — Liste und Flow-Chart teilen
sie, kein Hex pro Komponente. Echte Theme-Tokens:
- `active` → **#E8B86D** (Ctrl+K Sand/Gold, nur der eine aktive Schritt).
- `done` → `#6a6b6c` (grey-300, gedämpft) · `waiting` → `#434345` (grey-400,
  ausgegraut, Opacity < 1).
- Kanten: durchgezogen (`traversed`, Quelle erledigt) vs. gestrichelt-gedämpft
  (`upcoming`). Canvas: neutrales `#111214` (grey-700), kein bläuliches Schwarz.

## Wedge-Hook (Schritt ↔ Zusage)

Ein Flow-Schritt mit Kunden-Link zeigt einen dezenten Indikator „↳ Zusage an
X, fällig Fr" — `lib/db/queries/flows.ts` `resolveStepCommitments` matcht den
Schritt gegen offene, beleg-gesicherte Commitments (Prompt 3). Konsumiert die
commitments-Tabelle, **keine neue Schema-Spalte**. In beiden Ansichten sichtbar.

## 1. Todo-/Subtask-Ist-Zustand (vorher)

- Live-UI: **todos-v2** (`/todos` Übersicht, `/todos/[slug]` Gruppen-Detail).
- `todos`-Tabelle (title, description, status, priority, dueAt, scheduledTime …).
- Subtasks lagen in **eigener Tabelle** `todo_subtasks` (title/done/position) —
  **kein `parent_id` auf `todos`**. Flows brauchen eine geordnete Kette echter
  Todo-Schritte, daher die Schritt-Verknüpfung neu auf `todos` angelegt.

## 2. Datenmodell (minimal-invasiv, additiv)

Ein Flow ist ein **Todo mit `is_flow = true`**; seine **Schritte sind ganz
normale Todos** mit `flow_parent_id` → dem Flow. Eine Quelle, zwei Ansichten.
Migration `0050_todo_flows.sql` (alle Felder nullable/Default, bestehende
Todos unverändert):

| Feld | Zweck |
|---|---|
| `is_flow boolean` | markiert den Flow-Container |
| `flow_parent_id uuid` | Schritt → Flow (FK, ON DELETE cascade) |
| `step_order integer` | Reihenfolge (0-basiert, dicht) |
| `depends_on uuid` | Vorgänger-Schritt — **branch-ready**, linear nutzt nur `step_order` |

Schritte werden über `includeFlowSteps` aus den normalen Todo-Listen
ausgeschlossen, damit sie nur im Flow erscheinen.

## 3. Sequenz-Verhalten (`sequence.ts`, rein + getestet)

- **„aktiv" wird NICHT gespeichert**, sondern berechnet: der erste nicht-fertige
  Schritt in Reihenfolge. → Erledigt man den aktiven Schritt (ein einziger
  Status-Flip), wird der nächste **automatisch** aktiv, ohne Zusatz-Write.
- Zustände pro Schritt: `done` (erledigt/abgebrochen) · `active` · `upcoming`.
- Kanten: `depends_on` wenn gesetzt (zukunftssicher), sonst lineare
  Aufeinanderfolge; Dangling-Kanten werden verworfen.
- `reorderSteps` (hoch/runter, renormalisiert auf 0..n-1), `nextStepOrder`
  (Anhängen). Reihenfolge ist die einzige Wahrheit — beide Ansichten lesen
  exakt dasselbe `resolveFlow`-Ergebnis.

## 4. Liste (Default, Pflicht-Basis) — `flow-list-view.tsx`

Nummerierte Sequenz: aktiver Schritt im Sand/Gold-Akzent (`#E8B86D` aus dem
zentralen Token), erledigte gedämpft, wartende ausgegraut. Locked-caps
Status-Label je Zeile. Hinzufügen (Refokus für schnelles Erfassen),
Inline-Umbenennen, Hoch/Runter umordnen, Entfernen (mit Confirm), Abhaken.
**Voll funktional ohne den Flow-Chart.**

## 5. Flow-Chart (lazy) — `flow-graph-view.tsx`

`@xyflow/react` (etabliert, nicht from scratch). Knoten = Schritte, Pfeile =
Abhängigkeiten; **horizontales L→R-Auto-Layout** aus `step_order` (kein
manuelles Positionieren, kein freier Canvas). Kompakter Node: Titel + ein
Status-Label. Farben/Kanten aus `lib/flows/status.ts` (Sand/Gold nur AKTIV;
durchgezogene Kante = beschrittener Weg, gestrichelt = kommend; neutraler
grauer Canvas `#111214`). Knoten-Aktionen (abhaken / umbenennen / entfernen /
inline anhängen) schreiben in **dasselbe** Todo-Modell. **Lazy geladen** via
`next/dynamic({ ssr:false })` → React Flow landet nie im Listen-Bundle.

## 6. View-Toggle

`flow-detail-client.tsx` hält den Umschalter **Liste ⇄ Graph** über einer
Datenquelle; `/todos/flow/[id]` lädt den Flow server-seitig (`getFlow` →
`resolveFlow`). Einstieg + Flow-Liste in der Todos-Übersicht („Flows"-Sektion,
„+ Neuer Flow").

## 7. Abnahme + Intaktheit

```
npm run test:flows
```

12 Tests (Ordering, aktiver Schritt, Auto-Fortschritt, abgebrochen=done,
complete, leer, lineare Kanten, dependsOn/keine Dangling-Kanten, Reorder +
Grenze + Spiegelung in resolveFlow, nextStepOrder).

`tsc --noEmit` → **0 Fehler**. Gesamte Sequenz grün: Flows 12 · Trust 13 ·
Clients 14 · Plan 13 · Commitments 36 · Triage 18 = **106/106**. Bestehende
Todo-Funktion + Listenansicht unverändert (Flow-Schritte aus normalen Listen
gefiltert; alle Flow-Felder additiv).
