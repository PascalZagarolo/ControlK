# Morgen-Plan (`lib/morning-plan`)

Die EINE Oberfläche, in die der Nutzer morgens schaut. Eine **Synthese** über
die Quellen — keine nebeneinandergestellte Liste. Inbox, Kalender und Zusagen
sind **Inputs**, die hier zusammenlaufen und gegeneinander gerechnet werden.

## Konsumierte Datenquellen (nur lesen, nichts reimplementiert)

| Quelle | Woher | Was |
|---|---|---|
| „Braucht Antwort" (Prompt 1 Triage) | `getAwaitingSplit(ws,user).onYou` | ungelesene 1:1-Mail, die auf Antwort wartet (+ Wartetage) |
| Zusagen (Prompt 3) | `listOpenCommitments(ws,user)` | offene Commitments mit `confidence`, `dueAt`, `dueBasis`, **`sourceQuote`** |
| Kalender (optional) | `listCalendarEvents(ws, heute)` | heutige Termine; fehlt der Input → leer, Plan rendert trotzdem |
| Todos | `listTodos(ws,user)` | eigene Todos, gefiltert auf heute fällig / überfällig |

Der Plan **berechnet diese Daten nicht neu** — er ruft die bestehenden
Queries auf und mappt sie in neutrale Engine-Inputs (`build.ts`).

## Aufbau

```
types.ts       — reine Typen (Inputs + MorningPlan)
compute.ts     — DETERMINISTISCHE Engine: Priorisierung + Kollisionen (pure, getestet)
summarize.ts   — OPTIONALER LLM-Schritt: formuliert nur, erfindet nichts (server-only)
build.ts       — server-only: holt echte Daten, mappt, ruft compute + summarize
compute.test.ts — Abnahme-Suite (npm run test:morning-plan)
```

Screen: `app/plan/page.tsx` (Server) → `components/morning-plan/morning-plan-client.tsx`.
Ein-Tap-Aktionen: `lib/actions/morning-plan.ts` → delegiert an die bestehenden
Prompt-3/Inbox/Todo-Actions (kein eigener State).

## Was berechnet wird

**1. Priorisierter Strom** (ein Stream, alle Quellen gemischt). Score-Bänder,
höher = dringender:

```
überfällige Zusage   > heute fällige Zusage > wartende Mail
                     > heutiger Termin       > überfälliges Todo
                     > heute fälliges Todo   > zukünftige/undatierte Zusage
```

Kernregel: **zeitkritische Verpflichtungen gegenüber Menschen** (Zusagen,
wartende Kunden) ranken über internen Tasks. Innerhalb eines Bandes erhöhen
Überfälligkeitstage / Wartetage / Priorität den Score. Alles keyt auf ein
injiziertes `now` → vollständig deterministisch + testbar.

**2. Kollisionen** (der Differentiator — was keine Einzelquelle sieht):
- `due_today_vs_busy` — heute fällige Zusage + ≥2 Vormittagstermine.
- `multiple_overdue_commitments` — ≥2 überfällige Zusagen (nennt den Kunden, wenn geteilt).
- `customer_long_wait` — jemand wartet ≥4 Tage auf Antwort.

Kollisionen werden **nie erfunden**: gibt es keine, ist die Liste leer und der
Tag darf ehrlich „ruhig" sein.

**3. Erklärbarkeit:** Jedes Item trägt `reason` (Zusage → `source_sentence`;
Mail → Absender + Wartezeit) und einen stabilen `key`. **Halluzinations-Schutz
(Prompt 3):** eine Zusage **ohne `sourceQuote` wird nie gezeigt** — sowohl die
Query (`listOpenCommitments`) als auch die Engine filtern sie raus.

**4. Confidence-Gate:** `high` → Aussage („Du hast zugesagt: …"); `medium`/`low`
→ **Frage** („Sieht nach einer Zusage aus — stimmt das?") mit `confirm`/`dismiss`,
nie als Tatsache.

## Deterministisch vs. LLM

- **Items, Reihenfolge, Kollisionen, Counts** → 100 % `compute.ts`, kein LLM.
- **`summarize.ts`** bekommt nur die *bereits entschiedenen Fakten* (Zahlen +
  Kollisionstexte) und formuliert 1–2 assistierende Sätze. Es sieht keine
  Rohdaten → kann keine Items erfinden. Ohne AI-Key: deterministischer Fallback.
  Der Plan hängt nie vom LLM ab.

## Ton

Assistierend, nicht befehlend („Drei Dinge brauchen heute deine Aufmerksamkeit",
nicht „Bitte priorisiere…"). Selbstbewusst nur bei `high`, sonst fragend.

## Abnahme

```
npm run test:morning-plan
```

13 Tests, inkl. der vier Pflicht-Szenarien:
1. **Kollision** — heute fällige Zusage + voller Vormittag → Konflikt-Hinweis (und der Gegentest: kein Hinweis bei leerem Vormittag).
2. **Überfällige Zusagen** — zwei überfällige ranken oben, ältere zuerst + Sammel-Hinweis.
3. **Ruhiger Tag** — nichts offen → ehrlicher Ruhezustand, **keine** erfundenen Items.
4. **Low-confidence Zusage** — erscheint als Frage (`confirm`/`dismiss`), nicht als Behauptung.

Plus: Halluzinations-Schutz, Priorität Mensch>Task, wartende Mail>Termin,
Long-Wait-Kollision, Erklärbarkeit pro Item. Getestet wird die deterministische
Logik, **nicht** die LLM-Formulierung.
```
