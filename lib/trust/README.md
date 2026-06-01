# Trust-UX-Vereinheitlichung (`lib/trust`, Schritt 6)

Kein neues Feature — die über Prompt 3–5 verteilt eingebauten Vertrauens-
Verhalten (Herkunft, Confidence-Gating, Verwerfen, Ton) werden hier **überall
gleich** durchgesetzt und die Lücken geschlossen. Keine AI-Logik, keine neuen
Datenquellen, keine Reimplementierung — nur die Verhaltensschicht.

## 1. Inventar (Ist-Zustand → geschlossene Lücke)

| Aussage-Art | R1 Herkunft | R2 Confidence-Ton | R3 Ein-Tap-Korrektur | Lücke geschlossen |
|---|---|---|---|---|
| **Zusage** (P3) | ✅ `source_sentence` via „warum?" | ✅ firm vs. „bitte bestätigen" | ✅ Verwerfen/Ist Zusage | — (war konform) |
| **braucht Antwort** (P1) | ⚠️→✅ Cockpit zeigte nur `Xd` → jetzt „wartet seit X Tagen auf dich" | ✅ faktisch (kein Rateschluss → Aussage) | ✅ → Todo / nicht heute / erledigt | **`whyLabel` im Cockpit** |
| **Kollisions-Hinweis** (P4) | ⚠️→✅ war nur Satz → jetzt referenziert die betroffenen Items (`relatedKeys` → Titel-Chips) | ✅ assistierend, nie befehlend | n/a (Hinweis, keine Aktion) | **relatedKeys im Plan-UI** |
| **Mail→Todo-Vorschlag** (P5 C2) | ❌→✅ war `string[]` ohne Quelle → jetzt `{title, quote, confidence}` mit Beleg-Pflicht | ❌→✅ medium/low als Frage formuliert | ❌→✅ Ein-Tap „Verwerfen" pro Vorschlag | **`SuggestedAction` + Panel-Umbau** |

## 2. Einheitliche Regeln (R1–R4)

- **R1 Herkunft** — jede abgeleitete Aussage zeigt ihre Quelle:
  - Zusage → `sourceQuote`; braucht-Antwort → Absender + Wartezeit
    (`inbox-cockpit.tsx whyLabel`); Kollision → Titel-Chips der betroffenen
    Items (`morning-plan-client.tsx relatedTitles`); Todo-Vorschlag → der
    wörtliche Mail-Satz (`inbox-ai.ts` Quote-Guard, im Panel angezeigt).
  - **Halluzinations-Schutz überall:** kein Item/Vorschlag ohne nachprüfbare
    Quelle. Bei Zusagen DB- + Plan-seitig; bei Todo-Vorschlägen verwirft der
    Validator Aktionen ohne (oder mit erfundenem, nicht im Body vorkommendem)
    Zitat.
- **R2 Confidence-Ton** — `high` = Aussage, `medium`/`low` = Frage („… —
  stimmt das?"/„… — übernehmen?"). Gilt jetzt für Zusagen **und**
  Todo-Vorschläge; braucht-Antwort/Kollision sind deterministisch abgeleitet
  (kein Rateschluss) und daher korrekt faktisch. Unbekannte Confidence →
  Default `medium`, nie versehentlich `high`.
- **R3 Korrektur** — Ein-Tap, kein Bestätigungsdialog, gleiche Geste/Position
  überall (Verwerfen / nicht heute / erledigt). Zusagen speichern ein
  Negativ-Signal (`dismissCommitment`, P3). Todo-Vorschläge bekamen ein
  fehlendes „Verwerfen" pro Zeile.
- **R4 Ton** — durchgängig assistierend. Sweep über gerenderte Texte: keine
  „Bitte priorisiere…", kein „zeitnah/Du musst/Du solltest/dringend". Einziger
  Restbefund (Energy-Label „sofort erledigen") entschärft → „schnell
  dazwischen".

## 3. Geschlossene Lücken L1–L3

- **L1 Onboarding-Vertrauen** — Gmail-Connect-Copy nennt jetzt explizit, was
  Ctrl K liest (Posteingang→Triage, Gesendetes→Zusagen) **und** was es nicht
  tut („versendet nichts ohne deine Bestätigung und gibt nichts weiter").
  Der Plan kennt jetzt einen ehrlichen Erst-Zustand: `connectionState`
  (`ready`/`first_scan`/`not_connected`) — bei `first_scan` „Ich schaue gerade
  deine letzten Mails durch …" statt eines leeren „alles erledigt".
- **L2 Datenkontrolle** — bereits auffindbar unter `/settings/integrations`
  (Profil-Menü → „Integrationen"): verbundenes Konto, Scopes, Offline-Access,
  „Verbindung trennen", Link zu den Google-Berechtigungen. Bestätigt, nicht
  verändert.
- **L3 Fehler vs. Leer** — bleibt unterscheidbar: AI-Fehler liefern
  `ok:false` + konkrete Meldung („KI-Limit…", „fehlgeschlagen"); echte
  Leertreffer `ok:true` + „Keine neuen Zusagen gefunden". Der Plan trennt
  zusätzlich „nichts verbunden" / „erster Scan läuft" / „wirklich ruhig".

## 4. Abnahme

```
npm run test:trust
```

13 Checks: für **jede** der vier Aussage-Arten R1 (Herkunft), R2
(Confidence-Ton: high=Aussage / low=Frage), R3 (Ein-Tap-Korrektur), plus
Halluzinations-Schutz (Zusage + Todo-Vorschlag) und R4 (keine befehlenden
Kollisionstexte). Getestet wird der Daten-Vertrag, den das UI bindet — stabil,
nicht pixelabhängig.

Gesamte Sequenz grün: Trust 13 · Clients 14 · Plan 13 · Commitments 36 ·
Triage 18 = **94/94**, `tsc` 0 Fehler.
