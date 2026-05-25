# Plan — Sprint D: Row + Field-Level Permissions

**Status:** Draft.
**Vorbedingung:** A (Privacy-Bugs) und B (Personal-Workspace-Konsolidierung) sind gelandet — siehe Commit-Range "privacy + signup hardening".
**Dauer-Schätzung:** 5–7 Tage Solo-Builder.
**Risiko:** Hoch. Nachträglich Auth einzubauen ist Komplettumbau (Quote ARCHITECTURE.md). JETZT-oder-nie.

---

## Warum jetzt

Der heutige Stand ist ein Flickenteppich:

- `todos.visibility` ('private' | 'team' | 'account') wird in `listTodos` / `listTodosPage` enforced, in `todo-overview.ts` und Folge-Queries nicht durchgängig.
- `notes.scope` ('private' | 'workspace' | 'public') ist jetzt in den Haupt-Queries enforced (A2), aber jedes neue Modul-Query muss die Klausel manuell mitführen — leicht zu vergessen.
- `inbox_items.user_id` wird jetzt überall mitgefiltert (A1), aber das ist ein zweiter Mechanismus neben Visibility.
- `customers`, `contracts`, `vehicles`, `calendar_events`: kein Visibility-Konzept, alle Workspace-Mitglieder sehen alles.
- Field-Level Gating (z. B. `customers.notes`, `contracts.discountPct`) existiert nirgendwo.

Drei verschiedene Mechanismen für drei Module ist nicht haltbar. Sobald ein Modul dazukommt (z. B. Vertragsdokumente, Kunden-Dossiers), wird die nächste Privacy-Lücke geboren.

**Ziel:** Eine zentrale Policy-Engine, die jeder Read/Write-Pfad durchläuft. Module deklarieren ihre Sichtbarkeits-Regeln einmal, der Rest ergibt sich.

---

## Entscheidung: Eigene Policy-Engine in TS (Option 2 aus ARCHITECTURE.md)

Postgres RLS wäre sauberer auf DB-Ebene, hat aber zwei harte Pitfalls in diesem Stack:

1. Neon's serverless-driver hat keinen persistenten Connection-State — `SET LOCAL session.user_id` zwischen Pool-Statements ist unzuverlässig.
2. Drizzle's neon-http batch macht alle Statements in EINEM HTTP-Request, aber RLS-Context muss vor jedem Statement gesetzt sein, sonst greift die Policy nicht.

Eigene Engine ist mehr Code, aber:
- Komplett debuggbar (Stack-Trace zeigt warum etwas verweigert wurde)
- Versioniert mit dem Code (kein DB-Migrations-Tanz für Policy-Änderungen)
- Sucht Test-bar als reine Funktion
- Field-Level Gating ist trivial (DTO-Mapper liest Policy)

---

## Architektur

### Module-Layout

```
lib/permissions/
├── types.ts              # Subject, Action, Resource, Effect
├── engine.ts             # check() + assertCan()
├── query-wrappers.ts     # withReadPolicy() + helpers
├── field-gates.ts        # serialize-with-redaction
├── policies/
│   ├── todos.ts
│   ├── notes.ts
│   ├── customers.ts
│   ├── contracts.ts
│   ├── vehicles.ts
│   ├── calendar.ts
│   ├── inbox.ts
│   ├── channels.ts
│   └── index.ts          # registry: kind → policy
└── README.md             # how to add a new module's policy
```

### Kerntypen

```typescript
// types.ts
export type Subject = {
  userId: string;
  workspaceId: string;
  workspaceRole: 'owner' | 'admin' | 'member' | 'guest';
};

export type Action =
  | 'read' | 'list'
  | 'create' | 'update' | 'delete' | 'archive'
  | 'comment' | 'react'
  | 'invite' | 'share';

export type ResourceRef = {
  kind: 'todo' | 'note' | 'customer' | 'contract' | 'vehicle'
      | 'calendar_event' | 'inbox_item' | 'channel' | 'message';
  id: string;
};

export type Effect = 'allow' | 'deny';

export type Decision =
  | { effect: 'allow' }
  | { effect: 'deny'; reason: string };

export type Policy<Row> = {
  // For single-resource checks. Loads the row if needed, decides.
  check: (subject: Subject, resource: Row | null, action: Action) => Decision;

  // For list queries — returns a WHERE-clause fragment that the
  // query layer ANDs into the query. The fragment must work for both
  // findMany (raw drizzle) and select() builder usage.
  readFilter: (subject: Subject) => SQL;

  // Field-level redaction. Called by the DTO mapper for each row
  // returned by a read. Returns the row with sensitive fields nulled
  // out if the subject lacks the field-level permission.
  redact?: (subject: Subject, row: Row) => Row;
};
```

### Engine

```typescript
// engine.ts
import { policies } from './policies';

export function assertCan(
  subject: Subject,
  action: Action,
  resource: { kind: ResourceRef['kind']; row: any | null }
): void {
  const policy = policies[resource.kind];
  const decision = policy.check(subject, resource.row, action);
  if (decision.effect === 'deny') {
    throw new ForbiddenError(decision.reason);
  }
}

export function can(
  subject: Subject,
  action: Action,
  resource: { kind: ResourceRef['kind']; row: any | null }
): boolean {
  const policy = policies[resource.kind];
  return policy.check(subject, resource.row, action).effect === 'allow';
}

export class ForbiddenError extends Error {
  constructor(public reason: string) {
    super(`Forbidden: ${reason}`);
  }
}
```

### Query-Wrapper

```typescript
// query-wrappers.ts
export async function listWithPolicy<T extends { kind: ResourceRef['kind'] }>(
  subject: Subject,
  table: PgTable,
  kind: T['kind'],
  baseWhere: SQL | undefined
): Promise<any[]> {
  const policy = policies[kind];
  const policyClause = policy.readFilter(subject);
  const where = baseWhere ? and(baseWhere, policyClause) : policyClause;
  const rows = await db.select().from(table).where(where);
  return policy.redact
    ? rows.map((r) => policy.redact!(subject, r))
    : rows;
}
```

### Field-Gates

```typescript
// field-gates.ts
export function redactSensitive<T>(
  row: T,
  fields: Array<keyof T>,
  shouldRedact: boolean
): T {
  if (!shouldRedact) return row;
  const copy = { ...row };
  for (const f of fields) (copy as any)[f] = null;
  return copy;
}
```

---

## Phasen-Plan

### Phase 1 — Foundation (Tag 1)

**Liefere:**
- `lib/permissions/types.ts`
- `lib/permissions/engine.ts` mit `assertCan`, `can`, `ForbiddenError`
- `lib/permissions/query-wrappers.ts` (Skelett, noch nicht eingesetzt)
- Tests in `lib/permissions/__tests__/engine.test.ts` für Default-Behavior

**Was NICHT:** Noch keine konkreten Policies, noch keine Refactors.

**Checkpoint:** Engine kompiliert, kein bestehender Code touched.

---

### Phase 2 — Todos-Policy als Pilot (Tag 2)

Todos ist das beste Pilot-Modul: hat schon `visibility` Enum, der Read-Side-Filter existiert in 2 Funktionen, der Refactor zeigt direkt ob das Pattern trägt.

**Liefere:**
- `lib/permissions/policies/todos.ts`:
  ```typescript
  export const todosPolicy: Policy<Todo> = {
    check(subject, row, action) {
      if (!row) return { effect: 'allow' }; // create-path
      // Workspace-membership ist Voraussetzung (vorher gecheckt)
      if (action === 'read') {
        if (row.visibility !== 'private') return { effect: 'allow' };
        if (row.createdById === subject.userId) return { effect: 'allow' };
        if (row.assigneeId === subject.userId) return { effect: 'allow' };
        return { effect: 'deny', reason: 'Private todo not owned by you' };
      }
      if (action === 'update' || action === 'delete') {
        // Mitglieder dürfen team-todos editieren, private nur Owner
        if (row.visibility === 'private') {
          return row.createdById === subject.userId
            ? { effect: 'allow' }
            : { effect: 'deny', reason: 'Cannot edit other members' private todos' };
        }
        return { effect: 'allow' };
      }
      // …
    },
    readFilter(subject) {
      return or(
        ne(todos.visibility, 'private'),
        eq(todos.createdById, subject.userId),
        eq(todos.assigneeId, subject.userId)
      )!;
    },
  };
  ```

- Refactor `lib/db/queries/todos.ts`:
  - Alle Read-Funktionen nehmen `Subject` statt `userId/workspaceId` einzeln
  - Lokale `todosVisibilityClause` durch `todosPolicy.readFilter(subject)` ersetzt
  - `getTodo` ruft `assertCan(subject, 'read', { kind: 'todo', row })` nach dem findFirst
- Refactor `lib/actions/todos.ts` (alle Mutationen):
  - Vor jedem update/delete: `assertCan(subject, 'update', { kind: 'todo', row })`
  - Wirft `ForbiddenError` → Server-Action mapped auf `{ ok: false, error: ... }`

**Tests:**
- Owner kann fremde Workspace-Todo editieren
- Member kann fremde Workspace-Private-Todo NICHT editieren
- Member kann eigene Private-Todo editieren
- Read-Filter liefert keine fremden Private-Todos in der Liste

**Checkpoint:** /todos UI funktioniert mit zwei verschiedenen Test-Accounts wie erwartet.

---

### Phase 3 — Notes + Inbox migrieren (Tag 3)

Selbes Pattern. Notes hat schon `scope`-Enum + die jetzt eingeführte `notesVisibilityClause` — wird durch die Policy ersetzt. Inbox hat `userId` als Privacy-Boundary (kein Visibility-Enum) — der Policy-readFilter wird zu `eq(inboxItems.userId, subject.userId)`.

**Liefere:**
- `lib/permissions/policies/notes.ts`
- `lib/permissions/policies/inbox.ts`
- Refactor `lib/db/queries/notes.ts`, `lib/db/queries/inbox.ts`, `lib/db/queries/inbox-overview.ts`, `lib/db/queries/inbox-detail.ts`, `lib/db/queries/person-profile.ts`, `lib/foyer/briefing-signals.ts`
- Refactor `lib/actions/notes.ts`, `lib/actions/notes-actions.ts`, `lib/actions/inbox-actions.ts`

**Wichtig:** Die `notesAccessClause` und der `userId`-Filter, die in A1+A2 hinzugefügt wurden, werden hier durch `notesPolicy.readFilter(subject)` ersetzt. Kein Funktionsverlust, aber zentralisiert.

---

### Phase 4 — Customers/Contracts/Vehicles + Field-Level (Tag 4)

Diese Module haben **kein** Visibility-Konzept heute — alle Mitglieder sehen alles. Das bleibt der Default. Was sich ändert: Field-Level Gating für sensitive Felder.

**Liefere:**
- `lib/permissions/policies/customers.ts`:
  - Read: alle Mitglieder
  - `redact`: `notes`, `forecastContribution` nur für admin+, member sieht `null`
  - Update: admin+
  - Delete: owner

- `lib/permissions/policies/contracts.ts`:
  - Read: alle Mitglieder
  - `redact`: `discountPct`, `estimatedCostsCents` nur für admin+
  - Update: owner-of-contract (`contracts.createdBy`) oder admin+

- `lib/permissions/policies/vehicles.ts`:
  - Read: alle Mitglieder
  - `redact`: `acquisitionCents`, `monthlyFixedCostsCents` nur für admin+
  - Update: owner-of-vehicle oder admin+

- Drizzle's `columns: { ... }` Filter in den Queries: dynamisch je nach Subject-Rolle.
  Alternative: nicht columns filtern, immer alles selecten, dann `policy.redact` im DTO-Mapper.

**Pragmatische Wahl:** `redact` im DTO-Mapper (kein dynamisches columns-Filtering). Über-die-Leitung-bytes-Optimierung ist Phase 5+.

---

### Phase 5 — Calendar + Channels + Messages (Tag 5)

Calendar Events haben kein Visibility-Feld → Policy returnt `allow` für Workspace-Mitglieder. Aber: `kind='personal'` Events könnten auf scope-Niveau gehoben werden. Entscheidung: nicht in dieser Sprint.

Channels: `channel_members` Tabelle existiert — das IST die Zugangsliste. Policy: lies/schreib nur in Channels, in denen ich Member bin. Heute wird das NICHT enforced — alle Workspace-Mitglieder sehen alle Channels.

**Liefere:**
- `lib/permissions/policies/calendar.ts` (trivial — open)
- `lib/permissions/policies/channels.ts` (READ-Filter: subject.userId IN channel_members)
- `lib/permissions/policies/messages.ts` (transitiv via channel)

---

### Phase 6 — Cross-Cutting (Tag 6)

**Mention-Resolution:** Wenn jemand in einer Notiz `@Niklas` einfügt, wird der Customer/User aufgelöst. Wenn Niklas in einer privaten Notiz erwähnt wird, taucht das im Backlinks-Panel von Niklas auf — auch wenn Niklas die Notiz nicht lesen darf. Bug? Wahrscheinlich. Fix: mentions-resolution geht durch die gleiche Policy.

**Auto-Bootstrap-Race:** `bootstrapDefaultWorkspace` kann theoretisch beim ersten Zugriff race-zen, wenn zwei Requests parallel kommen (Tab-Restore). Heute mit Slug-Loop "wahrscheinlich okay", aber nicht atomar. Phase-6-Fix: Bootstrap auf Signup-Zeit verlegen (B1 hat das schon adressiert), Lazy-Path nur noch als Failsafe behalten und mit einer Distributed-Lock-DB-Row absichern. Optional, niedrige Priorität.

**Search-Routes:** `app/api/search/route.ts` + `app/api/search/global/route.ts` rufen Module-Queries mit `ws.id` (und nach A1+A2 mit `user.id`) auf. Nach der Migration nehmen sie `subject` und der Rest läuft durch.

---

### Phase 7 — Cutover + Cleanup (Tag 7)

**Liefere:**
- Sicherstellen, dass ALLE direkten `s.<table>.findMany`/`select`-Aufrufe entweder:
  - durch policy-aware Wrapper laufen ODER
  - explizit als "system-only" markiert sind (Crons, Auto-Rules, Webhooks)
- ESLint-Rule (custom oder via Schreibtisch-Audit): `db.query.*` darf nur in `lib/permissions/` oder mit `// @policy-bypass: <reason>` Kommentar verwendet werden
- Test-Suite: pro Modul mindestens 3 Test-Cases (read als Owner/Member/Outsider, update als Owner/Member)
- DEPLOY.md ergänzen: Note über "permissions live, deny defaults to 'allow' bei unbekanntem kind — fail-open für jetzt, fail-closed in Phase 8"

---

## Phase 8 — Externe Sharing (V2, separater Sprint)

Aus ARCHITECTURE.md Sprint D Step 5:

> Sharing-System: `ExternalAccess` Tabelle: `(entityType, entityId, email, role, expiresAt)`
> Magic-Link für Externe ohne Account
> Read-Only-Pfad: `/share/customer/<token>` etc.

Heute existiert das für einzelne Module als `*_share_links` Tabellen (`customer_share_links`, `contract_share_links`, …). Phase 8 vereinheitlicht das in `external_access` und die Policy-Engine kennt anonyme Subjects.

**NICHT** Teil von Sprint D. Dokumentieren, später bauen.

---

## Was NICHT in Sprint D gehört

- **Per-Field Edit-Permissions** (z. B. "Member darf customer.name ändern aber nicht customer.notes"): Phase 8+.
- **Custom Roles** über die 4 Built-ins hinaus: Phase 8+.
- **Audit-Log für Permission-Denials**: nice to have, Phase 8.
- **UI-Anzeige "warum kann ich das nicht?"** beyond einfacher Error-Toasts: Phase 8.

---

## Tests / Verifikations-Checkliste

Vor Merge:

- [ ] Zwei-User-Smoke-Test in einem shared Workspace:
  - User A erstellt Private Todo → User B sieht es nicht in /todos
  - User A erstellt Private Notiz → User B sieht es nicht in /notes
  - User B kann Workspace-Notiz von User A editieren
  - User B kann Private Notiz von User A NICHT editieren (auch nicht per direkter URL)
- [ ] Inbox-Privacy:
  - User A hat Gmail connected, User B nicht → User B sieht keine Mails von User A
  - User A kann seine eigenen Mails per /inbox/[id] öffnen
  - User B kann /inbox/[id] von User A NICHT öffnen (404)
- [ ] Field-Level:
  - Member sieht `customer.notes = null` in /kunden
  - Admin sieht echten Wert
  - Wenn Member über API direkt fragt: gleicher redacted-Wert
- [ ] Channel-Membership:
  - User in Workspace, nicht in Channel → /channels Liste zeigt Channel, aber /channels/[slug] = 403
- [ ] Performance:
  - `listTodos` Query-Plan vergleichen vor/nach. Policy-Filter darf keinen Sequential-Scan triggern (Index auf `(workspace_id, visibility)` evtl. nötig)
- [ ] Bestehende Cron-Routes (`/api/cron/todo-rules`, `recompute-caches`, `sync-inboxes`) laufen mit System-Subject (bypass policies)

---

## Migrations-Risiken

1. **Datenverlust durch zu strikte Default-Deny**: Wenn ein Modul vergessen wird, könnten Mitglieder plötzlich nichts mehr sehen. Mitigation: Phase 1 Engine defaultet auf `allow` für unbekannte kinds, Phase 8 schaltet das auf `deny`.

2. **Performance-Regression**: Visibility-Klauseln in jeder Query addieren WHERE-Bedingungen. Mitigation: Indizes proaktiv mit der Policy migration anlegen.

3. **Tests-Lücken**: Pre-Sprint-D-Code hat keine integrationstests die echte 2-User-Szenarios fahren. Phase 2-5 fügen pro Modul Cypress/Playwright-Smokes hinzu. Wenn Test-Setup zu groß → mindestens manuelle Smoke-Tests dokumentiert.

4. **Cron-Bypass-Pfad muss klar sein**: Crons brauchen einen `SystemSubject` der ALLES darf. Sonst stoppen Auto-Rules.

---

## Reihenfolge gegen Abhängigkeiten

```
Phase 1 (Engine)
   ↓
Phase 2 (Todos-Pilot)      ← Validates the pattern
   ↓
Phase 3 (Notes + Inbox)    ← Migrates existing visibility code
   ↓
Phase 4 (CRM + Field-Level) ← Adds redaction
   ↓
Phase 5 (Calendar + Channels) ← Channels intro membership-based
   ↓
Phase 6 (Cross-cutting)
   ↓
Phase 7 (Cutover + Tests)
```

Wenn die Pilot-Phase 2 zeigt, dass das Pattern nicht trägt: STOP, RLS-Variante neu evaluieren. NICHT alle Module migrieren mit unsicherem Foundation.

---

## Open Questions

1. **Soll `visibility='account'` weiter existieren?** Heute weiß niemand was es genau bedeutet (vermutlich: account = "über alle Workspaces hinweg sichtbar"). Empfehlung: in Phase 2 deprecaten, in Phase 7 entfernen. Aber: existing data hat es.

2. **Owner-Override**: Soll der Workspace-Owner per Default ALLES sehen können, auch private Notes anderer Mitglieder? Aktueller Code: NEIN, private bleibt private. Frage an Pascal: ist das das gewünschte Verhalten?

3. **Channel-Migration**: Heute sind ALLE Workspace-Mitglieder implizit in allen Channels (kein enforcement). Phase 5 würde das ändern. Migration nötig: bei jedem existierenden (workspace, channel)-Paar ein channel_members-Row für jedes Workspace-Member backfillen.

Diese Punkte vor Phase 2 mit Pascal klären.
