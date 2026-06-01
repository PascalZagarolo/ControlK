# Commitment extraction — Promise Tracker pipeline (`lib/commitments`)

The product's core wedge: read **sent** mail, find promises **the user made**,
resolve their deadline relative to the **send date**, and surface them before
they go overdue — with the **verbatim source sentence** as proof, and a
**confidence gate** so a guess is never shown as a fact.

Most of the pipeline already existed (Prompts 1–2). This module pulls the
accuracy-critical, **pure** parts out of the server-only code so they're
unit-testable, adds the missing **hallucination guard**, the deterministic
**relative-date resolver**, `due_date_basis`, a stronger **pre-filter**, and
the mandated **eval suite**.

## The pipeline (in order)

| Stufe | Was | Wo |
|---|---|---|
| **0 Quelle** | SENT-Mails (`direction='sent'`), inkrementell via `commitmentsScannedAt`-Marker, Fenster konfigurierbar (`COMMITMENT_SCAN_WINDOW_DAYS`, Default 30 Tage) | `lib/google/gmail-sync.ts`, `lib/db/queries/commitments.ts` (`listUnscannedSentItems`) |
| **1 Vorfilter** (kein AI) | `shouldSkipExtraction` = Newsletter/automated **oder** Low-Signal (reine Weiterleitung, Ein-Wort-Ack, leer) | `lib/commitments/prefilter.ts` |
| **2 Extraktion** (Claude) | strenger Prompt, JSON-only; Aufruf gekapselt | `lib/ai/commitment-extract.ts` |
| **2 Parsing** (pure) | `parseCommitmentResponse`: JSON-Parse (parse-fest → `[]`), Confidence-Clamp, Deadline-Auflösung | `lib/commitments/parse.ts` |
| **2 Frist** (pure) | `resolveRelativeDeadline`: „bis Freitag/morgen/in 3 Tagen/15.03." **relativ zum Sendedatum** | `lib/commitments/relative-date.ts` |
| **3 Confidence-Gate** | high → harte „fällig"; medium/low → „mögliche Zusage — bestätigen?" | `components/inbox/commitments-panel.tsx`, `queries/commitments.ts` |
| **3 Halluzinations-Schutz** | Kandidat **ohne `quote`** (oder mit erfundenem, nicht im Body vorkommendem Zitat) wird verworfen; quote-lose Alt-Zeilen werden **nicht angezeigt** und **nicht gezählt** | `parse.ts` + WHERE-Filter in `listOpenCommitments`/`getCommitmentCounts` |
| **4 Lifecycle** | offen/erledigt/überfällig/verworfen; konservatives Auto-Done; bestätigen/erledigt/verwerfen/→Todo | `lib/actions/commitments.ts` |

Nichts läuft durch den teuren AI-Schritt, das Stufe 1 schon aussortiert; bereits
gescannte Mails werden per Marker übersprungen. API-Key ausschließlich
serverseitig (`getEffectiveAIKey`), Aufrufe gedrosselt + gebatcht.

## Datenmodell

Bestehende Tabelle **`inbox_commitments`** erweitert (keine Duplizierung):
`source_quote` (Pflicht bei Anzeige), **neu** `due_basis` (verbatim Fristphrase),
`confidence`, `due_at`, `status`, `auto_done_at`. Migration
`0047_commitment_due_basis.sql` (additiv, nullable).

## Verifizierungs-Ansicht

`/inbox/validate` („Schritt 0 · Wedge-Test") — fährt den **echten** Extraktor
über die eigenen gesendeten Mails, **schreibt nichts in die DB**, zeigt jeden
Kandidaten mit Zitat + Confidence und rechnet die Precision live. Plus die
produktive `CommitmentsPanel` im Inbox-View (firm vs. „bitte bestätigen").

## Eval-Suite — das Abnahmekriterium

```
npm run test:commitments
```

- `eval/fixtures.ts` — gesendete Fixture-Mails mit bekanntem Erwartungswert:
  klare Zusage **mit** Frist (relativ zum Sendedatum aufgelöst), klare Zusage
  **ohne** Frist, **Höflichkeitsfloskeln/Fragen** (False-Positive-Tests),
  **mehrdeutig** → medium/low (nie high), **Halluzination ohne/mit erfundenem
  Zitat** (verworfen), **Prefilter**-Fälle (Newsletter, Ein-Wort, Weiterleitung).
- `eval/score.ts` — fährt jedes Fixture durch den **echten** Pfad (Prefilter →
  Parser → Guard → Datumsauflösung) und meldet **detected / missed /
  false-positive** pro Fixture + aggregiert.
- `units.test.ts` — Fokustests für Datumsauflösung, Prefilter, Parser/Guard.

Die Fixture-Suite ist **hermetisch**: statt eines Live-Calls liefert jedes
Fixture die plausible Modell-Antwort (`modelJson`), sodass die deterministische
Logik kostenlos und CI-stabil geprüft wird. Die **Modellgüte selbst** misst man
auf echten Daten (siehe unten).

### Real-Daten-Test (Pascals Schritt 0) — ohne Mailinhalte zu committen

Zwei Wege:

1. **Live, in der App:** `/inbox/validate` öffnen → „Validierungs-Scan starten".
   Nutzt echtes Gmail, schreibt nichts, zeigt Precision. Nichts verlässt den
   Server, nichts wird committet.

2. **Offline, versionierbar, key-frei:** ein lokales JSON mit eigenen Mails +
   erwarteten Werten gegen den **gleichen Scorer** laufen lassen:

   ```bash
   cp lib/commitments/eval/real-sample.example.json /tmp/my-sent.json
   # /tmp/my-sent.json mit echten Mails füllen (Schema: siehe Beispiel)
   COMMITMENT_EVAL_FILE=/tmp/my-sent.json npm run eval:commitments:real
   ```

   Gibt detected/missed/false-positive + recall/precision aus. Die Datei wird
   **nie** aus dem Repo gelesen; lege sie außerhalb ab (z. B. `/tmp`). Falls du
   sie doch im Repo hältst: `*.local.json` ist in `.gitignore` — echte
   Mailinhalte landen so nie im Commit.

## Konfiguration

- `COMMITMENT_SCAN_WINDOW_DAYS` — Look-back für den inkrementellen Scan
  (Default 30, geclamped 1–120).
- AI-Key/Endpoint: `getEffectiveAIKey` (BYOK → Gateway → `OPENAI_API_KEY`).
