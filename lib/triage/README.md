# Inbox noise-triage (`lib/triage`)

Stops marketing / notification / automated mail from being treated as
**„Braucht deine Antwort"**. This is the accuracy fix for the
„Chrono24-Problem": Chrono24 ads, GitHub notifications, CI-run failures,
ASOS/Temu/mydealz/Lieferando/REWE marketing, Resend/Bitly newsletters were
landing in the answer-required surfaces and the morning briefing.

## How „braucht Antwort" is actually decided (existing flow)

There is **no `needsReply` boolean** in the schema. A mail is answer-required
iff its `inbox_items.category` is `primary` or `customer`:

- `lib/foyer/briefing-signals.ts` → `category in ('primary','customer')`
  gates the morning brief's „Auf dich wartet" + unread count.
- `lib/db/queries/inbox-overview.ts` → `getAwaitingSplit()` uses the same
  clause for the inbox „Auf dich wartet | Du wartest auf" split.

`category` is written once, deterministically, at sync time by
`classifyMessage()` in `lib/google/classify-inbox.ts`. There is **no AI** on
the needs-reply path (only `classify-topic.ts` does per-domain topic
labelling for the sidebar — orthogonal).

### Root cause

Before this change, `classifyMessage` only had **one** noise signal: Gmail's
own `CATEGORY_*` ML labels. When Gmail attached no label (common for B2B-ish
promos, GitHub/CI notifications, many transactional senders) the mail fell
through to the `primary` catch-all → answer-required. No header rules, no
`no-reply@` rules.

## The pipeline (this module)

`triageMessage(input)` runs in order; first match wins, then it stops:

1. **Stage 1 — hard headers** (`classify.ts`): `List-Unsubscribe`, `List-Id`,
   `Auto-Submitted` (≠ `no`), `Precedence: bulk|list|junk`, empty
   `Return-Path` (`<>`). Provider-agnostic, deterministic. Most robust.
2. **Stage 1b — sender localpart**: `no-reply@`, `noreply@`, `notifications@`,
   `mailer-daemon@`, `bounce@`, `postmaster@`, `automated@`, `auto-confirm@`, …
3. **Stage 2 — supplementary domain lists** (`noise-rules.ts`): a small,
   curated marketing / notification / job-broadcast list. A *supplement* to
   the header rules, not a replacement.
4. **Stage 3 — AI**: intentionally **not** wired (see note in `classify.ts`).
   The decision is already deterministic, so there's no per-mail AI cost to
   gate. The candidates this pipeline returns (`isNoise === false`) are
   exactly the set a future AI „does this expect a reply?" stage may inspect.

**Confidence / default asymmetry:** a single hard signal is enough to call a
mail noise. We accept the rare false-exclusion of a bulky-but-real 1:1 mail —
a false „needs reply" alarm costs more trust than a missed reply (the
product's deliberate bias).

## Integration (minimal-invasive, no schema change)

`classifyMessage()` gained one stage, inserted (not replacing) between the
shipping check and Gmail's label:

```
customer → shipping → triageMessage() → gmailCategory → primary
```

Noise is mapped onto **existing** `inbox_category` buckets the answer-required
gate already excludes (`inbox-mapping.ts`): `marketing→promo`,
`transactional/notification→updates`, `job_broadcast→forums`. **No DB
migration, no UI change, no morning-plan change.**

`lib/google/gmail.ts` `getMessageMetadata()` now also fetches the five signal
headers (still `format=metadata`, same OAuth scope) and exposes them on
`ParsedGmailMessage`.

## Tests (acceptance criterion)

```
npm run test:triage
```

`triage.test.ts` pins the real production misclassifications as noise and a
set of genuine business mails as reply candidates. 18/18 must pass.

## Schema suggestion (NOT built — proposal only)

Reusing `promo`/`updates`/`forums` slightly overloads those buckets (they now
also hold header-detected noise, not only Gmail-labelled noise). If you later
want explainability („warum ist das hier herausgefiltert?") or analytics on
filter precision, consider adding **one nullable column**
`inbox_items.triage_reason text` (e.g. `"header:List-Unsubscribe"`), written
from `triageMessage().reason`. It's additive and backward-compatible — but not
required for the fix and deliberately left out here.
