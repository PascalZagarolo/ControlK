# Architecture Plan — Work-OS aus den Notion-Lessons

Strategische Roadmap. Jeder Punkt aus dem Brief → konkrete Datei-Änderung + Sprint-Estimat + Risiko. Reihenfolge nach **Reversibilität**: was später nicht mehr geht zuerst.

## Reducer-Prinzip

> **Local-first + relationale DB + opinionated Defaults.**

Das ist die EINE Entscheidung die später nicht mehr umkehrbar ist. Alles andere kann inkrementell. Konkret:

- **Local-first** für jede first-class Entity, beginnend mit Notes (= unser collab-heavy Use-Case). Persistenz in IndexedDB, später CRDT-Sync.
- **Relationale DB** haben wir (Drizzle + Neon, 40+ Tabellen typisiert) — nicht das generische Block-Modell von Notion.
- **Opinionated Defaults**: Workspace-Templates die sofort funktionieren — bereits gebaut (Vermietung, Familie, Agentur, …).

Zwei von drei Säulen stehen. Local-first ist der nicht-getane Schritt — daher Sprint A.

---

## Sprint-Plan (nach Reversibilität sortiert)

### Sprint A — Local-First Foundation (NICHT UMKEHRBAR — diesen jetzt)

**Aufwand:** 1-2 Tage Foundation + iteratives Polishing. **Risiko:** Bundle-Size, BlockNote-Edge-Cases bei Yjs.

**Schritte:**

1. **Yjs + IndexedDB als Persistence-Layer** in `components/notes/note-editor.tsx`:
   - `npm install yjs y-indexeddb`
   - `useCreateBlockNote({ collaboration: { fragment, ... } })` statt `initialContent`
   - Bootstrap der Yjs-Doc aus `initialDocument` falls fragment leer
   - IndexeddbPersistence pro Note-ID → Doc überlebt Reloads + Offline
   - Multi-Tab-Sync via broadcast channel (built-in bei y-indexeddb)
2. **Save-Queue** als eigener Modul `lib/notes/save-queue.ts`:
   - Bei jeder Doc-Änderung → IndexedDB sofort, Server debounced 800ms
   - Online-Status detection (`navigator.onLine` + ping)
   - Bei Offline → Queue im IndexedDB, Flush on Reconnect
3. **Konflikt-Resolution:** Server-Truth, Client-Recovery
   - Bei Reconnect: vergleiche `updatedAt` (client) vs Server
   - Wenn Server neuer → toast: „Server hat neuere Version, lokale Änderungen verworfen / behalten?"
   - Pragmatisch: für v1 Client-wins (Yjs-Doc-Hash als Tiebreaker)
4. **Sync-Provider Stub** für später:
   - `lib/notes/sync-provider.ts` — Interface, das Yjs-Updates über Pusher (oder Liveblocks später) leitet
   - Disabled per default; Feature-Flag `NEXT_PUBLIC_NOTES_REALTIME_SYNC`

**Was wir jetzt NICHT bauen:**
- Full CRDT-Sync über alle Devices (braucht persistenten Backend — Pusher als Transport ist möglich aber fragil; Liveblocks ist die saubere Lösung aber kostenpflichtig). Stub schon vorbereiten, Implementation in Sprint A.2.
- Local-first für Todos/Customers/Contracts — kommt in Sprint B, weil das tieferes Refactoring braucht.

**Files:**
- `components/notes/note-editor.tsx` (Yjs + IndexedDB)
- `lib/notes/save-queue.ts` (neu)
- `lib/notes/sync-provider.ts` (Stub)
- `package.json` (yjs, y-indexeddb deps)

---

### Sprint B — Server-Side Query Patterns + Virtualization (Foundation für Scale)

**Aufwand:** 3-4 Tage. **Risiko:** Refactoring bestehender Listen-Komponenten.

**Pain Point:** „Datenbanken müssen *echte* Datenbanken sein — Server-side Filtering/Sorting/Pagination. Niemals alle Rows im Client laden."

Aktueller Stand: `listTodos`, `listCustomers`, `listContracts`, `listVehicles` laden ALLE Workspace-Daten und geben sie als Array zurück. Funktioniert bei <500 Items, bricht bei 5000+.

**Schritte:**

1. **Cursor-Pagination-Pattern** als Modul `lib/db/cursor.ts`:
   ```ts
   type Cursor<T> = { id: string; sortKey: T };
   type Page<R> = { items: R[]; nextCursor: Cursor | null };
   ```
2. **Refactor `listTodos`** in `lib/db/queries/todos.ts`:
   - Signatur: `listTodos(workspaceId, userId, opts: { filter?, sort?, cursor?, limit? })`
   - Limit default 100
   - Sort by `(dueAt, createdAt, id)` für stable pagination
   - Filter-Schema strikt typisiert (kein `as any`)
3. **API-Route `/api/todos/list`** mit gleicher Signatur
4. **Client refactor `TodosClient`**:
   - Initial: erste 100 server-rendered
   - Infinite-scroll via `useSWRInfinite` oder eigener Hook
   - `react-virtuoso` für Liste (sieht Standard-Notion-langsame-Liste-Probleme nicht)
5. **Gleiche Logik für `/kunden`, `/vertraege`, `/flotte`** — können sequentiell nach `/todos`-MVP

**Files:**
- `lib/db/cursor.ts` (neu)
- `lib/db/queries/todos.ts` (refactor)
- `lib/db/queries/customers.ts` (refactor)
- `lib/db/queries/contracts.ts` (refactor)
- `lib/db/queries/vehicles.ts` (refactor)
- `app/api/todos/list/route.ts` (neu)
- `components/todos/todos-client.tsx` (virtualization)
- `components/customers/kunden-list-client.tsx` (virtualization)
- `package.json` (`react-virtuoso`)

**Was wir NICHT bauen:**
- Server-side aggregation (Rollups/Formulas) — separater Sprint C.

---

### Sprint C — Precomputed Rollups + Materialized Views

**Aufwand:** 2-3 Tage. **Risiko:** Migration-Strategie für Backfill.

**Pain Point:** „Rollups, Formulas, Relations: precompute auf Schreibzeit, nicht auf Lesezeit. Materialized Views oder denormalisierte Cache-Spalten."

Aktuell: `customers.activeContracts`, `contracts.value`, `todos.context` werden teilweise schon precomputed via `enrichRows`. Aber nicht konsistent.

**Schritte:**

1. **Cache-Spalten** auf relevanten Entities:
   - `customers.cached_active_contract_count` (int)
   - `customers.cached_open_todo_count` (int)
   - `customers.cached_last_touchpoint_at` (timestamptz)
   - `vehicles.cached_utilization_30d` (numeric)
2. **Trigger / Update-on-Write** in den Server-Actions:
   - `createContract` → updated cached_active_contract_count des Customers
   - `createTodo` mit customerId → updated cached_open_todo_count
   - Pattern: kleine Helper-Funktion `recomputeCustomerCache(customerId)` die nach jeder mutating action läuft
3. **Backfill-Migration** 0017:
   - Eine pure-SQL Migration die alle Cache-Spalten aus den existierenden Rows berechnet
4. **Query-Pfad nutzt Cache** statt live-Aggregation in `listCustomers`
5. **Health-Check-Cron**: `/api/cron/recompute-caches` läuft 1× pro Stunde, fängt drifts ab

**Files:**
- `lib/db/migrations/0017_entity_caches.sql` (neu)
- `lib/db/schema.ts` (cached_* Spalten)
- `lib/db/cache-recompute.ts` (neu — Helper-Funktionen)
- Mehrere `lib/actions/*` Touch-Points
- `app/api/cron/recompute-caches/route.ts` (neu)
- `vercel.json` (cron eintragen)

---

### Sprint D — Permissions: Row-Level + Field-Level

**Aufwand:** 1 Woche. **Risiko:** Hoch — nachträglich Auth einbauen ist riskant. JETZT-oder-nie.

**Pain Point:** „Row-level und Field-level Permissions von Anfang an. Nachträglich einbauen = Komplettumbau."

Aktueller Stand: nur Workspace-Member-Check (`requireRole`) auf Routes. Keine Row-Level (kann jeder Member jedes Todo sehen) und keine Field-Level.

**Optionen:**

**Option 1: Postgres RLS direkt** — Säuberste Lösung, aber Neon's serverless-driver hat Pitfalls mit RLS-Context.

**Option 2: Eigene Policy-Engine** in TS, vor jedem Query/Action. Mehr Code, aber explizit.

Empfehlung: **Option 2**. Schöner für Solo-Dev, debuggbar, version-controlled.

**Schritte:**

1. **Policy-Modul** `lib/permissions/policies.ts`:
   ```ts
   type Policy<E> = (subject: User, entity: E, action: Action) => Allow | Deny;
   ```
2. **Per-Entity Policies**:
   - `policies/todos.ts`, `policies/customers.ts`, etc.
   - Default: workspace-member → read; creator|assignee → write; admin → delete
   - Owner-Override: Workspace-Owner kann alles
3. **Query-Wrappers** statt direkte Queries:
   - `withReadPolicy(query, subject)` wrappt `where`-Clause mit Policy-Filter
   - `assertCan(action, subject, entity)` in Actions vor jeder Mutation
4. **Field-Level**: nicht alle Felder im SELECT
   - Sensitive Felder (customer.notes, contract.discountPct) per Policy gated
   - Drizzle's `columns: { ... }` filter dynamisch
5. **Sharing-System**:
   - `ExternalAccess` Tabelle: `(entityType, entityId, email, role, expiresAt)`
   - Magic-Link für Externe ohne Account
   - Read-Only-Pfad: `/share/customer/<token>` etc. (haben wir schon für einige Entities)

**Files:**
- `lib/permissions/` (komplett neuer Ordner)
- Touch fast jeder `lib/actions/*` und `lib/db/queries/*`

---

### Sprint E — Mobile UX (Bottom-Sheet + Read-First)

**Aufwand:** 3-4 Tage. **Risiko:** Mittel — BlockNote auf Mobile ist tricky.

**Pain Point:** „Slash-Commands müssen auch auf Mobile funktionieren. Mobile ist kein Companion."

**Schritte:**

1. **Native Bottom-Sheet** für Slash-Menü auf Mobile:
   - BlockNote's `SuggestionMenuController` kann custom-rendered werden
   - Bei `window.innerWidth < 768` → Bottom-Sheet statt Floating-Menü
   - Component `components/notes/mobile-slash-sheet.tsx`
2. **Mobile-FAB** existiert schon — erweitern um:
   - Long-Press → Voice-Capture direkt
   - Swipe-Up → Quick-Create-Menü
3. **Read-Optimierte Mobile-Views**:
   - `/todos` Mobile: Kompakter, große Touch-Targets
   - `/notes/[id]` Mobile: Read-first (Edit-Mode nur on explicit tap)
   - Mobile-Detection via `useMediaQuery`
4. **PWA-Polish**:
   - `apple-touch-icon` real (echtes PNG, nicht SVG)
   - Status-Bar-Color matched dark theme
   - Splash-Screens für iOS

**Files:**
- `components/notes/mobile-slash-sheet.tsx` (neu)
- `components/pwa/mobile-fab.tsx` (extend)
- `components/todos/mobile-list.tsx` (neu)
- `lib/hooks/use-media-query.ts` (neu)
- `public/icon-{192,512,180}.png` (manuell)

---

### Sprint F — Embedded AI + BYOK

**Aufwand:** 2 Tage. **Risiko:** Niedrig — wir haben schon den AI-Tool-Loop.

**Pain Point:** „AI eingebettet, nicht angeflanscht. BYOK-Option."

Aktueller Stand: `/api/notes/ai` mit Tool-Use gated auf `AI_GATEWAY_API_KEY`. AI-Panel im Note-Detail.

**Schritte:**

1. **Inline-Completion** in BlockNote (Cursor-style):
   - Ghost-Text auf Pause: BlockNote-Extension oder ProseMirror-Plugin
   - Trigger nur explizit (Tab nach Pause oder `++` typed)
2. **Smart-Filter** in `/kunden`, `/todos`:
   - „zeig mir alle Kunden die seit 14d stumm sind und einen offenen Vertrag haben" → AI parsed zu Filter-Objekt → existing query
3. **Semantische Suche**:
   - Embeddings via pgvector (Neon supports it) auf Notes-Content
   - Nightly-Cron embedded → Suche via similarity
4. **BYOK** (user-level API-key):
   - `user_settings` Tabelle: `userId, openaiKey (encrypted), aiPreferences jsonb`
   - Encryption: AES-256-GCM, Key aus `APP_ENCRYPTION_KEY` env
   - UI: `/settings/ai` — Eingabe + Validation-Test
   - `getEffectiveAIKey(userId)` ruft user-key bevorzugt, dann env-key
5. **Cost-Tracking**:
   - `ai_usage` Tabelle: `userId, tokens, costCents, at`
   - Anzeige im Settings: „Du hast diesen Monat 12k tokens verbraucht ≈ €0,15"

**Files:**
- `lib/db/migrations/0018_user_settings_ai_usage.sql` (neu)
- `lib/db/schema.ts` (extend)
- `lib/ai/get-effective-key.ts` (neu)
- `app/settings/ai/page.tsx` (neu)
- `app/api/notes/ai/route.ts` (refactor um getEffectiveAIKey)
- Wahrscheinlich `@ai-sdk/openai` für robustes Streaming

---

### Sprint G — Native Integrationen

**Aufwand:** Pro Integration 2-3 Tage. Wenn alle gemacht: 2 Wochen.

**Pain Point:** „Native Integrationen für: Google Calendar, Outlook, Slack, GitHub, Linear/Jira."

**Plan (sequentiell, priority-sorted):**

1. **Google Calendar** (zuerst — Demo-tauglich):
   - OAuth via Vercel (kein eigener Auth-Server)
   - 2-Way-Sync: uRent-Events → GCal + GCal-Events → uRent (markiert mit `source: 'gcal'`)
   - `lib/integrations/gcal/` — sync-engine
   - User-Settings-Tab `/settings/integrations`
2. **Outlook** (paralleler — gleiches Pattern wie GCal)
3. **Slack**:
   - Slash-Command-App `/urent` in Slack
   - Channel-Webhook → Channel-Message
   - Tieferes: `@urent kunde Müller` → öffnet Detail-Modal in Slack
4. **GitHub**:
   - PR-Status auf Todos
   - Issue-Sync (für Agentur-Workflows)
5. **Linear/Jira**:
   - Read-only: Issues als Live-Embed
   - Write später

**Files (pro Integration):**
- `lib/integrations/<name>/oauth.ts`
- `lib/integrations/<name>/sync.ts`
- `app/api/integrations/<name>/callback/route.ts`
- `app/api/integrations/<name>/webhook/route.ts`
- `app/api/cron/sync-<name>/route.ts`
- `app/settings/integrations/<name>/page.tsx`

**Was wir NICHT bauen:**
- Generic Zapier — bewusst gegen die Strategie (Tiefe statt Breite)

---

### Sprint H — Compliance (EU + DSGVO)

**Aufwand:** 1 Tag Doku + Hosting-Config. **Risiko:** Niedrig.

**Pain Point:** „EU-Hosting als Option, idealerweise Default. DSGVO-konform, AVV out-of-the-box."

**Schritte:**

1. **Vercel-Region auf `fra1` setzen** (Frankfurt). `vercel.json` oder `vercel.ts`:
   ```ts
   functions: { '**/*.{ts,tsx}': { regions: ['fra1'] } }
   ```
2. **Neon-Region**: bei DB-Erstellung EU-Region wählen (uRent ist schon auf `eu-central-1` lt. .env)
3. **Pusher**: cluster auf `eu`
4. **AVV-Template** als public PDF, link aus `/legal/avv`
5. **Datenschutz-Erklärung** generiert per Template, link `/legal/privacy`
6. **Daten-Export** für User: `/settings/data-export` → JSON-Dump aller User-zugehörigen Workspaces
7. **Konto-Löschung** (echt, nicht nur deaktivieren) → `/settings/account/delete` mit cascade-delete
8. **Cookie-Banner**? Nicht nötig wenn wir keine Drittanbieter-Cookies setzen (haben wir nicht).

**Files:**
- `vercel.json` (regions)
- `app/legal/avv/page.tsx`
- `app/legal/privacy/page.tsx`
- `app/legal/imprint/page.tsx`
- `app/settings/data-export/page.tsx` + Action
- `app/settings/account/delete/page.tsx` + Action

---

### Sprint I — Pricing + Billing

**Aufwand:** 3-4 Tage mit Stripe. **Risiko:** Mittel — Plan-Gating ist Querschnitt.

**Pain Point:** „Fairer Personal-Tier. Per-Seat transparent."

**Schritte:**

1. **Plan-Modell** in DB:
   - `subscriptions(workspaceId, plan, seats, stripeSubId, currentPeriodEnd)`
2. **3 Tiers:**
   - **Free**: 1 User, 3 Workspaces, 100 Notes, 100 AI-Tokens/Tag (über env-Key), unbeschränkte Todos/Customers, kein Premium-Support
   - **Solo (€8/Monat)**: 1 User, unbegrenzt, 50k AI-Tokens/Monat (BYOK = ohne Limit)
   - **Team (€12/User/Monat)**: ab 2 Member, alle Features, EU-Hosting-Garantie, Support
3. **Stripe-Integration**:
   - Checkout-Sessions
   - Webhooks für subscription events
   - `lib/billing/`
4. **Gate-Mechanism**:
   - `requirePlan(workspaceId, minPlan)` in Actions
   - UI shows upgrade-prompts
5. **Honest gating**:
   - Permissions NICHT hinter Paywall (Pain-Point: „keine Feature-Gating-Tricks bei Basisfunktionen")
   - API NICHT hinter Paywall

**Files:**
- `lib/billing/stripe.ts`
- `lib/billing/plans.ts`
- `app/api/webhooks/stripe/route.ts`
- `app/settings/billing/page.tsx`
- Migration für `subscriptions` Tabelle

---

### Sprint J — Support + Onboarding

**Aufwand:** 2 Tage.

**Pain Point:** „Schneller, sichtbarer Support."

**Schritte:**

1. **In-App-Chat** mit Owner — nicht intercom, eigener Channel `#support` pro User (skaliert nicht, aber funktioniert bis 100 Kunden)
2. **Sichtbarer Help-Button** unten rechts (Modal mit Search durch Docs + „Frag Pascal direkt")
3. **Onboarding-Tour** Erstmaliger Login:
   - 3 Steps: Workspace-Setup, Templates-Pick, first Note
   - State in `user.onboarding_progress` jsonb
4. **Status-Page** `status.urent.app` — Uptime + Incidents (statisch zu Beginn)

---

## Was wir explizit NICHT bauen (jetzt)

- **Full CRDT-Sync über alle Devices** für Notes (Sprint A.2, nach Foundation)
- **Generic Block-Editor** für Customers/Contracts/Vehicles — bewusst, weil typisierte Forms besser sind
- **Marketplace** (3rd-party-Plugins) — viel später
- **Mobile native Apps** (iOS/Android) — PWA reicht für jetzt
- **Whiteboard / Canvas-Mode** (Sprint X später)
- **Code-Execution-Sandbox** in Notes — interessant, nicht jetzt
- **Image-Annotation** — nice-to-have, kein USP

---

## Reihenfolge / Was wann

| Sprint | Was | Dauer | Wann |
|---|---|---|---|
| A | Local-First Foundation | 1-2d | **JETZT** (diese Session anfangen) |
| F-BYOK | AI BYOK + User-Settings | 1d | direkt im Anschluss |
| H | EU-Hosting + DSGVO-Doku | 1d | vor erstem öffentlichen Release |
| B | Server-Pagination + Virtualization | 3-4d | sobald >500 Items im System |
| C | Precomputed Caches | 2-3d | sobald Latenz fühlbar |
| E | Mobile UX | 3-4d | parallel zu B/C |
| D | Permissions System | 5-7d | vor B2B-Kunden mit >2 Members |
| G | Native Integrationen | 2 Wochen | nach erstem Kunden-Feedback (Priorität: GCal) |
| I | Pricing + Billing | 3-4d | vor erstem zahlenden Kunden |
| J | Support + Onboarding | 2d | vor öffentlichem Launch |

---

## Diese Session

1. **Sprint A.1 implementieren**: Yjs + IndexedDB in Notes-Editor
2. **Sprint F.4 (BYOK):** User-Settings-Page für eigenen OpenAI-Key
3. **Sprint H (EU/DSGVO Docs)**: Erweitere DEPLOY.md um Region-Setup + AVV-Stub
4. **Kleine UX-Wins:** Globale Keyboard-Shortcuts (Cmd+B Brief, Cmd+/ Help)

Die großen restlichen Brocken (B, C, D, E, G, I, J) sind hier dokumentiert, werden in separaten Sessions sprintweise implementiert.
