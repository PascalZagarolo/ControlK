# Kundenzentrierte Inbox + Mail→Todo (`lib/clients`, Schritt 5)

Der zweite Wedge-Pfeiler: Mail **um Kunden herum** organisiert (statt nur
chronologisch) und **Mail→Todo** als geschlossener Loop in den Morgen-Plan.
Konsumiert Prompt 1 (Triage), Prompt 3 (Commitments) und Prompt 4 (Plan) —
reimplementiert nichts davon.

## Bestehender Stand + konsumierte Quellen

| Quelle | Woher | Genutzt für |
|---|---|---|
| „Braucht Antwort" (Prompt 1) | `inbox_items.category in ('primary','customer')` + unread | „Wartet"-Gate (rauschfrei), `needsReply`-Flag |
| Commitments (Prompt 3) | `inbox_commitments` (status=open, quote≠leer) | offene Zusagen pro Kunde in „Nach Kunde" |
| Todos (Prompt 3/4) | `createTodoFromInboxItem` (bestehend!) | Mail→Todo C1 — schreibt in die **bestehende** Todo-Struktur |
| Plan (Prompt 4) | `getAwaitingSplit().onYou`, `listTodos` | „Wartet"-Mails + erzeugte Todos erscheinen dort konsistent |

**Wichtig:** „customer" gab es schon — als **schweres workspace-CRM**
(`customers`+`customerContacts`, nur E-Mail, braucht vorab angelegten Datensatz).
Das deckt das Prompt-Ziel nicht: nötig war ein **leichtgewichtiges, manuelles,
pro-Nutzer-Tag** (E-Mail **oder Domain**, optionaler Name, ein Tap aus der Mail,
ohne CRM-Setup). Daher neue Tabelle `contact_tags` — kein Duplikat des CRM,
sondern die fehlende leichte Variante. Die Views erkennen einen Kunden, wenn
**entweder** ein Tag **oder** ein CRM-Kontakt passt.

## A — Manuelles Kunden-Tagging

- Schema: `contact_tags` (`id, workspace_id, user_id, kind('email'|'domain'),
  identifier, display_name, created_at`), Unique `(user_id, identifier)` →
  Re-Taggen aktualisiert statt zu duplizieren. Migration `0048_contact_tags.sql`.
- Actions: `lib/actions/contact-tags.ts` — `tagSenderAsClient` (E-Mail **oder**
  ganze Domain), `untagContact`, `isSenderTagged`. Strikt manuell.
- Niedrigschwelliger Einstieg: `TagClientButton` direkt in der Mail-Toolbar
  (`app/inbox/[id]/inbox-detail-client.tsx`) — „＋ Als Kunde markieren" →
  „Nur diese Adresse" / „Ganze Firma", optionaler Anzeigename.
- **Keine Auto-Erkennung** (bewusst). Marker: `// TODO: optionale
  Auto-Kunden-Erkennung später` in `schema.ts` + `contact-tags.ts`.

## B — Die drei Views (additiv; chronologische Ansicht bleibt)

Route `app/inbox/clients?view=…`, erreichbar über „◉ Kunden-Inbox →" in der
bestehenden Inbox. Resolver: `lib/clients/resolve.ts` (rein, getestet) — Präzedenz
exakter E-Mail-Tag → CRM-Kontakt → Domain-Tag.

- **B1 „Nach Kunde"** (`getClientGroups`): Threads gruppiert pro Kunde; nicht
  getaggte Absender in einer neutralen Gruppe **„Andere/Ungetaggt"** (nie als
  Kunde). Pro Kunde: Mails, ungelesen, `braucht Antwort`-Flag, **offene Zusagen**
  (Prompt 3).
- **B2 „Wartet"** (`listWaitingOnYou`): ungelesene 1:1-Mail, längste Wartezeit
  oben. Baut **direkt** auf dem Prompt-1-Gate (`category in
  ('primary','customer')`) → Marketing/No-Reply erscheinen nie.
- **B3 „Von Kunden"** (`listClientMail`): chronologisch, nur Mail von getaggten/
  bekannten Kunden — newsletter-/job-broadcast-frei.

## C — Mail → Todo

- **C1 (Pflicht, bestehend, wiederverwendet):** `createTodoFromInboxItem`
  erzeugt ein Todo in der **bestehenden** Struktur (Titel aus Betreff,
  Rück-Link zur Gmail-Mail in der Description) und **archiviert** die Quell-Mail.
  Erreichbar per „→ Todo" in Toolbar, Liste, Foyer-Stack. Nicht neu gebaut.
- **C2 (KI-Vorschlag):** bereits durch Prompt 3 abgedeckt — `summarizeInboxEmail`
  schlägt Aktionen vor (Vorschlag, kein Auto-Anlegen) und Commitments tragen
  Confidence (medium/low = Frage). Kein zweiter paralleler Mechanismus nötig.

## Konsistenz mit dem Morgen-Plan (keine Doppelzählung)

`createTodoFromInboxItem` **archiviert** die Mail. Der Plan liest „braucht
Antwort" aus `getAwaitingSplit().onYou`, das `isArchived=false` filtert — die
konvertierte Mail fällt also aus „Wartet"/„braucht Antwort" raus und erscheint
nur noch als Todo. Eine Mail wird nie doppelt gezählt. (Test:
`resolve.test.ts` → „konvertierte (archivierte) Mail fällt aus Wartet raus".)

## Abnahme

```
npm run test:clients
```

14 Tests: Tagging (E-Mail/Domain/CRM → Kunde; Newsletter → in **keiner** View),
Präzedenz, Identifier-Normalisierung, „Wartet"-Gate (Kundenmail erscheint,
No-Reply/Marketing nicht; Wartezeit in Tagen), Mail→Todo ohne Doppelzählung.
Getestet wird die deterministische Resolver-/Gate-Logik, nicht das React/DB-Glue.
