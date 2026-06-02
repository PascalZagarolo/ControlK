import 'server-only';
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';
import { resolveClient, type ClientMatch, type ContactTag } from '@/lib/clients/resolve';
import { listOpenCommitments } from './commitments';
import { listWorkspaceMembers } from './members';

// ─── Contact tags (lightweight per-user client marks) ───────────────

export type ContactTagRow = {
  id: string;
  kind: 'email' | 'domain';
  identifier: string;
  displayName: string | null;
  note: string | null;
};

/** All of the current user's tags in this workspace. */
export async function listContactTags(
  workspaceId: string,
  userId: string
): Promise<ContactTagRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: s.contactTags.id,
      kind: s.contactTags.kind,
      identifier: s.contactTags.identifier,
      displayName: s.contactTags.displayName,
      note: s.contactTags.note,
    })
    .from(s.contactTags)
    .where(and(eq(s.contactTags.workspaceId, workspaceId), eq(s.contactTags.userId, userId)))
    .orderBy(desc(s.contactTags.createdAt));
  return rows;
}

/**
 * Whether a sender is already a client for this user — tag (exact OR domain)
 * OR CRM contact. Used to set the initial UI state of the tag button. Pure
 * read, no action overhead.
 */
export async function isSenderTaggedForUser(
  workspaceId: string,
  userId: string,
  email: string | null
): Promise<boolean> {
  if (!email) return false;
  const { tags, crmEmails } = await loadClientSignals(workspaceId, userId);
  return resolveClient(email, tags, crmEmails).isClient;
}

/** Emails known to the workspace CRM — the second client signal. */
export async function listCrmContactEmails(workspaceId: string): Promise<Set<string>> {
  const db = getDb();
  const rows = await db
    .select({ email: sql<string>`lower(${s.customerContacts.email})` })
    .from(s.customerContacts)
    .innerJoin(s.customers, eq(s.customers.id, s.customerContacts.customerId))
    .where(and(eq(s.customers.workspaceId, workspaceId), sql`${s.customerContacts.email} is not null`));
  return new Set(rows.map((r) => r.email));
}

/** Both client signals for a user, ready to feed resolveClient(). */
export async function loadClientSignals(
  workspaceId: string,
  userId: string
): Promise<{ tags: ContactTag[]; crmEmails: Set<string> }> {
  const [tags, crmEmails] = await Promise.all([
    listContactTags(workspaceId, userId),
    listCrmContactEmails(workspaceId).catch(() => new Set<string>()),
  ]);
  return {
    tags: tags.map((t) => ({ kind: t.kind, identifier: t.identifier, displayName: t.displayName })),
    crmEmails,
  };
}

// ─── Shared row shape for the client-centric views ──────────────────

type SenderAgg = {
  senderEmail: string | null;
  senderName: string;
  total: number;
  unread: number;
  latest: Date;
  hasNeedsReply: boolean;
};

export type ClientGroup = {
  /** Stable key: the matched identifier (email or "domain:x") or "__other__". */
  key: string;
  displayName: string;
  isClient: boolean;
  via: ClientMatch['via'];
  senders: { email: string | null; name: string }[];
  totalCount: number;
  unreadCount: number;
  /** true when any thread in the group currently "braucht Antwort" (Prompt 1). */
  needsReply: boolean;
  latestReceivedAt: string;
  /** Open commitments the user owes to this client (Prompt 3). */
  openCommitments: number;
};

const DAY_MS = 86_400_000;

// ── B1: "Nach Kunde" — sender groups, clients first, plus an "Andere" bucket.
//
// Resolves each sender via tags + CRM (resolveClient). Non-clients collapse
// into a single neutral "Andere/Ungetaggt" group — never shown AS a client.
export async function getClientGroups(
  workspaceId: string,
  userId: string
): Promise<{ clients: ClientGroup[]; other: ClientGroup | null }> {
  const db = getDb();
  const { tags, crmEmails } = await loadClientSignals(workspaceId, userId);

  // Aggregate inbound mail per sender (non-archived, non-future-snoozed).
  // hasNeedsReply mirrors the Prompt-1 triage gate: only primary/customer
  // category, unread → counts as "braucht Antwort" noise-free.
  const rows = await db
    .select({
      senderEmail: s.inboxItems.senderEmail,
      senderName: sql<string>`max(${s.inboxItems.senderName})`,
      total: sql<number>`count(*)::int`,
      unread: sql<number>`sum(case when ${s.inboxItems.isRead} = false then 1 else 0 end)::int`,
      latest: sql<Date>`max(${s.inboxItems.receivedAt})`,
      needsReply: sql<number>`sum(case when ${s.inboxItems.isRead} = false and ${s.inboxItems.direction} = 'inbox' and ${s.inboxItems.category} in ('primary','customer') then 1 else 0 end)::int`,
    })
    .from(s.inboxItems)
    .where(
      and(
        eq(s.inboxItems.workspaceId, workspaceId),
        eq(s.inboxItems.userId, userId),
        eq(s.inboxItems.direction, 'inbox'),
        eq(s.inboxItems.isArchived, false),
        or(isNull(s.inboxItems.snoozedUntil), sql`${s.inboxItems.snoozedUntil} <= now()`)!
      )
    )
    .groupBy(s.inboxItems.senderEmail)
    .orderBy(sql`max(${s.inboxItems.receivedAt}) desc`)
    .limit(500);

  const aggs: SenderAgg[] = rows.map((r) => ({
    senderEmail: r.senderEmail,
    senderName: r.senderName,
    total: Number(r.total),
    unread: Number(r.unread),
    latest: r.latest,
    hasNeedsReply: Number(r.needsReply) > 0,
  }));

  // Bucket by resolved client identity.
  const byKey = new Map<string, ClientGroup>();
  const otherSenders: SenderAgg[] = [];

  for (const a of aggs) {
    const match = resolveClient(a.senderEmail, tags, crmEmails);
    if (!match.isClient || !match.key) {
      otherSenders.push(a);
      continue;
    }
    const existing = byKey.get(match.key);
    if (existing) {
      existing.totalCount += a.total;
      existing.unreadCount += a.unread;
      existing.needsReply = existing.needsReply || a.hasNeedsReply;
      existing.senders.push({ email: a.senderEmail, name: a.senderName });
      if (new Date(a.latest) > new Date(existing.latestReceivedAt))
        existing.latestReceivedAt = new Date(a.latest).toISOString();
    } else {
      byKey.set(match.key, {
        key: match.key,
        displayName: match.displayName || a.senderName,
        isClient: true,
        via: match.via,
        senders: [{ email: a.senderEmail, name: a.senderName }],
        totalCount: a.total,
        unreadCount: a.unread,
        needsReply: a.hasNeedsReply,
        latestReceivedAt: new Date(a.latest).toISOString(),
        openCommitments: 0,
      });
    }
  }

  // Attach open-commitment counts per client (Prompt 3 — consumed, not rebuilt).
  await attachCommitmentCounts(workspaceId, userId, byKey);

  const clients = [...byKey.values()].sort(
    (a, b) => new Date(b.latestReceivedAt).getTime() - new Date(a.latestReceivedAt).getTime()
  );

  let other: ClientGroup | null = null;
  if (otherSenders.length > 0) {
    const total = otherSenders.reduce((n, a) => n + a.total, 0);
    const unread = otherSenders.reduce((n, a) => n + a.unread, 0);
    const latest = otherSenders.reduce(
      (m, a) => (new Date(a.latest) > new Date(m) ? new Date(a.latest).toISOString() : m),
      new Date(0).toISOString()
    );
    other = {
      key: '__other__',
      displayName: 'Andere / Ungetaggt',
      isClient: false,
      via: null,
      senders: otherSenders.map((a) => ({ email: a.senderEmail, name: a.senderName })),
      totalCount: total,
      unreadCount: unread,
      needsReply: false,
      latestReceivedAt: latest,
      openCommitments: 0,
    };
  }

  return { clients, other };
}

// Sum open commitments per resolved client. Commitments key on recipientEmail;
// we match them to a client group by the same resolver so counts are consistent.
async function attachCommitmentCounts(
  workspaceId: string,
  userId: string,
  byKey: Map<string, ClientGroup>
): Promise<void> {
  if (byKey.size === 0) return;
  const db = getDb();
  const rows = await db
    .select({
      recipientEmail: sql<string>`lower(${s.inboxCommitments.recipientEmail})`,
      n: sql<number>`count(*)::int`,
    })
    .from(s.inboxCommitments)
    .where(
      and(
        eq(s.inboxCommitments.workspaceId, workspaceId),
        eq(s.inboxCommitments.userId, userId),
        eq(s.inboxCommitments.status, 'open'),
        sql`${s.inboxCommitments.recipientEmail} is not null`,
        // Hallucination guard (Prompt 3) — never count quote-less rows.
        sql`${s.inboxCommitments.sourceQuote} is not null and length(trim(${s.inboxCommitments.sourceQuote})) > 0`
      )
    )
    .groupBy(sql`lower(${s.inboxCommitments.recipientEmail})`);

  // Map each commitment recipient onto a client key via the senders we grouped.
  const emailToKey = new Map<string, string>();
  for (const g of byKey.values()) {
    for (const sn of g.senders) {
      if (sn.email) emailToKey.set(sn.email.toLowerCase(), g.key);
    }
  }
  for (const r of rows) {
    const key = emailToKey.get(r.recipientEmail);
    if (key) {
      const g = byKey.get(key);
      if (g) g.openCommitments += Number(r.n);
    }
  }
}

// ── B3: "Von Kunden" — chronological, only mail from tagged/known clients.
export type ClientMailRow = {
  id: string;
  senderName: string;
  senderEmail: string | null;
  subject: string | null;
  preview: string | null;
  receivedAt: string;
  isRead: boolean;
  clientName: string;
};

export async function listClientMail(
  workspaceId: string,
  userId: string,
  limit = 100
): Promise<ClientMailRow[]> {
  const db = getDb();
  const { tags, crmEmails } = await loadClientSignals(workspaceId, userId);
  if (tags.length === 0 && crmEmails.size === 0) return [];

  const rows = await db
    .select({
      id: s.inboxItems.id,
      senderName: s.inboxItems.senderName,
      senderEmail: s.inboxItems.senderEmail,
      subject: s.inboxItems.subject,
      preview: s.inboxItems.preview,
      receivedAt: s.inboxItems.receivedAt,
      isRead: s.inboxItems.isRead,
    })
    .from(s.inboxItems)
    .where(
      and(
        eq(s.inboxItems.workspaceId, workspaceId),
        eq(s.inboxItems.userId, userId),
        eq(s.inboxItems.direction, 'inbox'),
        eq(s.inboxItems.isArchived, false),
        or(isNull(s.inboxItems.snoozedUntil), sql`${s.inboxItems.snoozedUntil} <= now()`)!
      )
    )
    .orderBy(desc(s.inboxItems.receivedAt))
    .limit(limit * 4); // over-fetch; we filter to clients in code

  const out: ClientMailRow[] = [];
  for (const r of rows) {
    const match = resolveClient(r.senderEmail, tags, crmEmails);
    if (!match.isClient) continue;
    out.push({
      id: r.id,
      senderName: r.senderName,
      senderEmail: r.senderEmail,
      subject: r.subject,
      preview: r.preview,
      receivedAt: new Date(r.receivedAt).toISOString(),
      isRead: r.isRead,
      clientName: match.displayName || r.senderName,
    });
    if (out.length >= limit) break;
  }
  return out;
}

// ── B2: "Wartet" — who is waiting on YOU, longest first.
//
// CONSUMES the Prompt-1 triage gate directly: inbound, unread, non-archived,
// non-snoozed, category in ('primary','customer'). That gate is exactly the
// "braucht Antwort" definition, so newsletters / no-reply senders never appear
// here. We annotate each row with the resolved client name when known.
export type WaitingRow = {
  id: string;
  senderName: string;
  senderEmail: string | null;
  subject: string | null;
  preview: string | null;
  receivedAt: string;
  waitingDays: number;
  clientName: string | null;
  isClient: boolean;
};

export async function listWaitingOnYou(
  workspaceId: string,
  userId: string,
  limit = 50
): Promise<WaitingRow[]> {
  const db = getDb();
  const { tags, crmEmails } = await loadClientSignals(workspaceId, userId);

  const rows = await db
    .select({
      id: s.inboxItems.id,
      senderName: s.inboxItems.senderName,
      senderEmail: s.inboxItems.senderEmail,
      subject: s.inboxItems.subject,
      preview: s.inboxItems.preview,
      receivedAt: s.inboxItems.receivedAt,
    })
    .from(s.inboxItems)
    .where(
      and(
        eq(s.inboxItems.workspaceId, workspaceId),
        eq(s.inboxItems.userId, userId),
        eq(s.inboxItems.direction, 'inbox'),
        eq(s.inboxItems.isRead, false),
        eq(s.inboxItems.isArchived, false),
        // The Prompt-1 noise gate — keeps marketing/no-reply OUT of "Wartet".
        sql`${s.inboxItems.category} in ('primary','customer')`,
        or(isNull(s.inboxItems.snoozedUntil), sql`${s.inboxItems.snoozedUntil} <= now()`)!
      )
    )
    .orderBy(s.inboxItems.receivedAt) // oldest first = longest waiting at the top
    .limit(limit);

  const now = Date.now();
  return rows.map((r) => {
    const match = resolveClient(r.senderEmail, tags, crmEmails);
    return {
      id: r.id,
      senderName: r.senderName,
      senderEmail: r.senderEmail,
      subject: r.subject,
      preview: r.preview,
      receivedAt: new Date(r.receivedAt).toISOString(),
      waitingDays: Math.max(0, Math.floor((now - new Date(r.receivedAt).getTime()) / DAY_MS)),
      clientName: match.isClient ? match.displayName : null,
      isClient: match.isClient,
    };
  });
}

// ─── Auto-customer SUGGESTIONS (propose, never auto-tag) ────────────

export type ClientSuggestion = {
  email: string;
  name: string;
  count: number;
};

/**
 * Frequent senders the user has NOT tagged and that aren't CRM contacts —
 * surfaced as gentle "als Kunde markieren?" suggestions. Pure proposal: never
 * auto-tags. Noise-free via the Prompt-1 category gate; dismissed senders are
 * remembered so they don't reappear.
 */
export async function suggestClientTags(
  workspaceId: string,
  userId: string,
  opts: { minCount?: number; limit?: number } = {}
): Promise<ClientSuggestion[]> {
  const minCount = opts.minCount ?? 4;
  const limit = opts.limit ?? 5;
  const db = getDb();

  const [{ tags, crmEmails }, dismissedRows, rows] = await Promise.all([
    loadClientSignals(workspaceId, userId),
    db
      .select({ identifier: s.clientSuggestionDismissals.identifier })
      .from(s.clientSuggestionDismissals)
      .where(
        and(
          eq(s.clientSuggestionDismissals.workspaceId, workspaceId),
          eq(s.clientSuggestionDismissals.userId, userId)
        )
      ),
    db
      .select({
        senderEmail: s.inboxItems.senderEmail,
        senderName: sql<string>`max(${s.inboxItems.senderName})`,
        n: sql<number>`count(*)::int`,
      })
      .from(s.inboxItems)
      .where(
        and(
          eq(s.inboxItems.workspaceId, workspaceId),
          eq(s.inboxItems.userId, userId),
          eq(s.inboxItems.direction, 'inbox'),
          eq(s.inboxItems.isArchived, false),
          sql`${s.inboxItems.category} in ('primary','customer')`,
          sql`${s.inboxItems.senderEmail} is not null`
        )
      )
      .groupBy(s.inboxItems.senderEmail)
      .having(sql`count(*) >= ${minCount}`)
      .orderBy(sql`count(*) desc`)
      .limit(50),
  ]);

  const dismissed = new Set(dismissedRows.map((d) => d.identifier));
  const out: ClientSuggestion[] = [];
  for (const r of rows) {
    const email = r.senderEmail?.trim().toLowerCase();
    if (!email) continue;
    // Already a client (tag or CRM) → not a suggestion. Already dismissed → skip.
    if (resolveClient(email, tags, crmEmails).isClient) continue;
    if (dismissed.has(email)) continue;
    out.push({ email, name: r.senderName || email, count: Number(r.n) });
    if (out.length >= limit) break;
  }
  return out;
}

// ─── Kundenmanagement (calm customer OVERVIEW — NOT a CRM) ──────────
//
// A read-only AGGREGATION over existing wedge data, anchored on the user's
// contact_tags (per-user). Every metric below is COMPUTED from commitments +
// mail metadata — nothing is a maintained/structured field. The only manual
// input is contact_tags.note (optional). No pipelines/stages/forecast/owner.

/** The tag's stable client key — identical to resolveClient()'s key format. */
function tagKey(kind: 'email' | 'domain', identifier: string): string {
  return kind === 'email' ? identifier : `domain:${identifier}`;
}

export type CustomerOverviewRow = {
  /** Detail-route + action id: contact_tags.id ('tag') or customers.id ('manual'). */
  id: string;
  /** 'tag' = per-user tagged client (Prompt 5); 'manual' = shared business contact. */
  entity: 'tag' | 'manual';
  /** resolveClient key (email/"domain:x") for tags; "customer:<id>" for manual. */
  key: string;
  kind: 'email' | 'domain';
  identifier: string;
  displayName: string;
  note: string | null;
  /** Manual contacts only: the free status + company (null for tagged clients). */
  status: string | null;
  company: string | null;
  /** Open promises the user owes this client (Prompt 3, quote-guarded). */
  openCommitments: number;
  /** Subset of openCommitments already past their due date. */
  overdueCommitments: number;
  /** Age (days) of the oldest unanswered inbound mail; null if none waiting. */
  waitingDays: number | null;
  /** true when any thread currently "braucht Antwort" (Prompt 1 gate). */
  needsReply: boolean;
  /** Latest mail in EITHER direction; null if no mail on record. For manual
   *  (shared) contacts this is workspace-wide (the team's last contact). */
  lastInteractionAt: string | null;
  /** Days since the last interaction (server-computed, hydration-safe). */
  lastInteractionDays: number | null;
  /** Manual (shared) contacts: which team member had the last interaction. */
  lastInteractionBy: { id: string; name: string; initials: string } | null;
  /** Manual contacts: optional responsibility (a member, or null = beide). */
  assignedTo: { id: string; name: string; initials: string } | null;
  unreadCount: number;
};

/**
 * The customer list — all of the current user's tagged clients with their
 * urgency metrics computed from commitments + mail. Sorted by the same
 * business-critical priority as the morning plan: overdue promises first,
 * then longest wait, then open promises, then most recent contact.
 *
 * CONSUMES: loadClientSignals + resolveClient (identity), listOpenCommitments
 * (Prompt 3), inbox_items (Prompts 1/5 gates). Reimplements nothing.
 */
export async function listCustomerOverview(
  workspaceId: string,
  userId: string,
  opts: { includeManual?: boolean } = {}
): Promise<CustomerOverviewRow[]> {
  const db = getDb();
  const [tagRows, { tags, crmEmails }] = await Promise.all([
    listContactTags(workspaceId, userId),
    loadClientSignals(workspaceId, userId),
  ]);
  if (tagRows.length === 0 && !opts.includeManual) return [];

  // Inbound mail aggregated per sender (same gates as getClientGroups +
  // listWaitingOnYou): non-archived, non-future-snoozed; "needs reply" =
  // unread primary/customer; oldest such mail drives the waiting age.
  const inbound = await db
    .select({
      senderEmail: s.inboxItems.senderEmail,
      total: sql<number>`count(*)::int`,
      unread: sql<number>`sum(case when ${s.inboxItems.isRead} = false then 1 else 0 end)::int`,
      latest: sql<Date>`max(${s.inboxItems.receivedAt})`,
      needs: sql<number>`sum(case when ${s.inboxItems.isRead} = false and ${s.inboxItems.category} in ('primary','customer') then 1 else 0 end)::int`,
      oldestNeeds: sql<Date | null>`min(${s.inboxItems.receivedAt}) filter (where ${s.inboxItems.isRead} = false and ${s.inboxItems.category} in ('primary','customer'))`,
    })
    .from(s.inboxItems)
    .where(
      and(
        eq(s.inboxItems.workspaceId, workspaceId),
        eq(s.inboxItems.userId, userId),
        eq(s.inboxItems.direction, 'inbox'),
        eq(s.inboxItems.isArchived, false),
        or(isNull(s.inboxItems.snoozedUntil), sql`${s.inboxItems.snoozedUntil} <= now()`)!
      )
    )
    .groupBy(s.inboxItems.senderEmail)
    .limit(2000);

  // Latest SENT mail per recipient — the other half of "last interaction".
  const sent = await db
    .select({
      recipientEmail: s.inboxItems.recipientEmail,
      latest: sql<Date>`max(${s.inboxItems.receivedAt})`,
    })
    .from(s.inboxItems)
    .where(
      and(
        eq(s.inboxItems.workspaceId, workspaceId),
        eq(s.inboxItems.userId, userId),
        eq(s.inboxItems.direction, 'sent'),
        sql`${s.inboxItems.recipientEmail} is not null`
      )
    )
    .groupBy(s.inboxItems.recipientEmail)
    .limit(2000);

  // Open commitments → resolve recipient to a client key, count open + overdue.
  const commitments = await listOpenCommitments(workspaceId, userId);

  type Agg = {
    total: number;
    unread: number;
    needsReply: boolean;
    latestInbound: number | null;
    latestSent: number | null;
    oldestNeeds: number | null;
    open: number;
    overdue: number;
  };
  const byKey = new Map<string, Agg>();
  const ensure = (key: string): Agg => {
    let a = byKey.get(key);
    if (!a) {
      a = { total: 0, unread: 0, needsReply: false, latestInbound: null, latestSent: null, oldestNeeds: null, open: 0, overdue: 0 };
      byKey.set(key, a);
    }
    return a;
  };

  for (const r of inbound) {
    const m = resolveClient(r.senderEmail, tags, crmEmails);
    if (!m.isClient || !m.key) continue;
    const a = ensure(m.key);
    a.total += Number(r.total);
    a.unread += Number(r.unread);
    if (Number(r.needs) > 0) a.needsReply = true;
    const lt = r.latest ? new Date(r.latest).getTime() : null;
    if (lt && (a.latestInbound === null || lt > a.latestInbound)) a.latestInbound = lt;
    const on = r.oldestNeeds ? new Date(r.oldestNeeds).getTime() : null;
    if (on && (a.oldestNeeds === null || on < a.oldestNeeds)) a.oldestNeeds = on;
  }
  for (const r of sent) {
    const m = resolveClient(r.recipientEmail, tags, crmEmails);
    if (!m.isClient || !m.key) continue;
    const a = ensure(m.key);
    const lt = r.latest ? new Date(r.latest).getTime() : null;
    if (lt && (a.latestSent === null || lt > a.latestSent)) a.latestSent = lt;
  }
  for (const c of commitments) {
    const m = resolveClient(c.recipientEmail, tags, crmEmails);
    if (!m.isClient || !m.key) continue;
    const a = ensure(m.key);
    a.open += 1;
    if (c.overdueDays !== null && c.overdueDays > 0) a.overdue += 1;
  }

  const now = Date.now();

  // Manual (shared) business contacts, if requested. They live on the existing
  // customers/customer_contacts model and own a SET of emails; per-user metrics
  // sum the byKey aggregates over those emails, while last-interaction is read
  // workspace-wide (the team's last contact). coveredKeys lets us drop tag rows
  // that a manual contact already represents (no double-listing).
  const manualRows: CustomerOverviewRow[] = [];
  const coveredKeys = new Set<string>();
  if (opts.includeManual) {
    // Workspace members → id/name/initials, for "who last" + assignee labels.
    const members = await listWorkspaceMembers(workspaceId).catch(() => []);
    const memberById = new Map(members.map((m) => [m.id, { id: m.id, name: m.name, initials: m.initials }]));

    const contacts = await db
      .select({
        id: s.customers.id,
        name: s.customers.name,
        company: s.customers.company,
        contactStatus: s.customers.contactStatus,
        notes: s.customers.notes,
        assignedTo: s.customers.assignedTo,
        email: sql<string | null>`lower(${s.customerContacts.email})`,
      })
      .from(s.customers)
      .leftJoin(s.customerContacts, eq(s.customerContacts.customerId, s.customers.id))
      .where(and(eq(s.customers.workspaceId, workspaceId), eq(s.customers.source, 'manual')))
      .limit(2000);

    // Group emails per contact.
    const byContact = new Map<
      string,
      { name: string; company: string | null; status: string | null; note: string | null; assignedTo: string | null; emails: string[] }
    >();
    for (const r of contacts) {
      let c = byContact.get(r.id);
      if (!c) {
        c = { name: r.name, company: r.company, status: r.contactStatus, note: r.notes || null, assignedTo: r.assignedTo, emails: [] };
        byContact.set(r.id, c);
      }
      if (r.email && !c.emails.includes(r.email)) c.emails.push(r.email);
    }

    // Workspace-wide last contact per email (both directions, all members),
    // INCLUDING which member it was. The contact's address is the SENDER on
    // inbound mail but the RECIPIENT on sent mail, so we take the latest row
    // per email in each direction (DISTINCT ON) and merge by recency.
    const allEmails = [...new Set([...byContact.values()].flatMap((c) => c.emails))];
    const teamLastByEmail = new Map<string, { at: number; userId: string | null }>();
    if (allEmails.length > 0) {
      const senderLower = sql`lower(${s.inboxItems.senderEmail})`;
      const recipientLower = sql`lower(${s.inboxItems.recipientEmail})`;
      const [inboundLast, sentLast] = await Promise.all([
        // Contact wrote to us: sender = contact, inbound only.
        db
          .selectDistinctOn([senderLower], {
            email: sql<string>`lower(${s.inboxItems.senderEmail})`,
            at: s.inboxItems.receivedAt,
            userId: s.inboxItems.userId,
          })
          .from(s.inboxItems)
          .where(
            and(
              eq(s.inboxItems.workspaceId, workspaceId),
              eq(s.inboxItems.direction, 'inbox'),
              inArray(senderLower, allEmails)
            )
          )
          .orderBy(senderLower, desc(s.inboxItems.receivedAt)),
        // We wrote to the contact: recipient = contact, sent only.
        db
          .selectDistinctOn([recipientLower], {
            email: sql<string>`lower(${s.inboxItems.recipientEmail})`,
            at: s.inboxItems.receivedAt,
            userId: s.inboxItems.userId,
          })
          .from(s.inboxItems)
          .where(
            and(
              eq(s.inboxItems.workspaceId, workspaceId),
              eq(s.inboxItems.direction, 'sent'),
              inArray(recipientLower, allEmails)
            )
          )
          .orderBy(recipientLower, desc(s.inboxItems.receivedAt)),
      ]);
      for (const r of [...inboundLast, ...sentLast]) {
        if (!r.email || !r.at) continue;
        const t = new Date(r.at).getTime();
        const prev = teamLastByEmail.get(r.email);
        if (prev === undefined || t > prev.at) teamLastByEmail.set(r.email, { at: t, userId: r.userId });
      }
    }

    // If the same address sits on two manual contacts (a data-quality slip —
    // there's no workspace-unique constraint), each email's metrics must be
    // counted ONCE, not summed into both contacts. claimedEmails enforces that.
    const claimedEmails = new Set<string>();
    for (const [id, c] of byContact) {
      // Per-user metrics: sum the byKey aggregates over the contact's emails.
      let open = 0, overdue = 0, unread = 0, needsReply = false;
      let oldestNeeds: number | null = null;
      for (const email of c.emails) {
        coveredKeys.add(email);
        if (claimedEmails.has(email)) continue;
        claimedEmails.add(email);
        const a = byKey.get(email);
        if (!a) continue;
        open += a.open;
        overdue += a.overdue;
        unread += a.unread;
        if (a.needsReply) needsReply = true;
        if (a.oldestNeeds != null && (oldestNeeds === null || a.oldestNeeds < oldestNeeds)) {
          oldestNeeds = a.oldestNeeds;
        }
      }
      // Team-wide last interaction across the contact's emails — incl. who.
      let teamLast: { at: number; userId: string | null } | null = null;
      for (const e of c.emails) {
        const t = teamLastByEmail.get(e);
        if (t && (teamLast === null || t.at > teamLast.at)) teamLast = t;
      }
      const lastBy = teamLast?.userId ? (memberById.get(teamLast.userId) ?? null) : null;
      const assignee = c.assignedTo ? (memberById.get(c.assignedTo) ?? null) : null;
      manualRows.push({
        id,
        entity: 'manual',
        key: `customer:${id}`,
        kind: 'email',
        identifier: c.emails[0] ?? '',
        displayName: c.name,
        note: c.note,
        status: c.status,
        company: c.company,
        openCommitments: open,
        overdueCommitments: overdue,
        waitingDays: oldestNeeds != null ? Math.max(0, Math.floor((now - oldestNeeds) / DAY_MS)) : null,
        needsReply,
        lastInteractionAt: teamLast ? new Date(teamLast.at).toISOString() : null,
        lastInteractionDays: teamLast != null ? Math.max(0, Math.floor((now - teamLast.at) / DAY_MS)) : null,
        lastInteractionBy: lastBy,
        assignedTo: assignee,
        unreadCount: unread,
      });
    }
  }

  // Tag rows — skipping any key already represented by a manual contact.
  const rows: CustomerOverviewRow[] = tagRows
    .filter((t) => !coveredKeys.has(tagKey(t.kind, t.identifier)))
    .map((t) => {
      const key = tagKey(t.kind, t.identifier);
      const a = byKey.get(key);
      const lastInteraction = Math.max(a?.latestInbound ?? 0, a?.latestSent ?? 0) || null;
      return {
        id: t.id,
        entity: 'tag' as const,
        key,
        kind: t.kind,
        identifier: t.identifier,
        displayName: t.displayName?.trim() || t.identifier,
        note: t.note,
        status: null,
        company: null,
        openCommitments: a?.open ?? 0,
        overdueCommitments: a?.overdue ?? 0,
        waitingDays:
          a?.oldestNeeds != null ? Math.max(0, Math.floor((now - a.oldestNeeds) / DAY_MS)) : null,
        needsReply: a?.needsReply ?? false,
        lastInteractionAt: lastInteraction ? new Date(lastInteraction).toISOString() : null,
        lastInteractionDays:
          lastInteraction != null ? Math.max(0, Math.floor((now - lastInteraction) / DAY_MS)) : null,
        // Per-user tagged clients aren't shared, so no team attribution/assignee.
        lastInteractionBy: null,
        assignedTo: null,
        unreadCount: a?.unread ?? 0,
      };
    });

  rows.push(...manualRows);

  // Urgency default (consistent with the morning plan): overdue promises →
  // longest wait → open promises → most recent contact.
  rows.sort((a, b) => {
    if (a.overdueCommitments !== b.overdueCommitments) return b.overdueCommitments - a.overdueCommitments;
    const aw = a.waitingDays ?? -1;
    const bw = b.waitingDays ?? -1;
    if (aw !== bw) return bw - aw;
    if (a.openCommitments !== b.openCommitments) return b.openCommitments - a.openCommitments;
    const at = a.lastInteractionAt ? new Date(a.lastInteractionAt).getTime() : 0;
    const bt = b.lastInteractionAt ? new Date(b.lastInteractionAt).getTime() : 0;
    return bt - at;
  });

  return rows;
}

// ── Customer detail (summary, not a maintained profile) ──

export type DetailCommitment = {
  id: string;
  promiseText: string;
  sourceQuote: string;
  dueAt: string | null;
  dueBasis: string | null;
  overdueDays: number | null;
  confidence: 'high' | 'medium' | 'low';
  /** low/medium confidence → render as a question, never asserted (Prompt 3). */
  isQuestion: boolean;
  sourceItemId: string | null;
};

export type DetailThread = {
  id: string;
  sourceId: string | null;
  subject: string | null;
  preview: string | null;
  receivedAt: string;
  waitingDays: number;
};

export type DetailTimelineEntry = {
  id: string;
  direction: 'inbox' | 'sent';
  subject: string | null;
  receivedAt: string;
  who: string;
};

export type CustomerDetail = {
  tagId: string;
  kind: 'email' | 'domain';
  identifier: string;
  displayName: string;
  note: string | null;
  openCommitments: DetailCommitment[];
  doneCommitments: DetailCommitment[];
  waitingThreads: DetailThread[];
  timeline: DetailTimelineEntry[];
};

/**
 * One customer's calm summary, all computed. Ownership-checked (the tag must
 * belong to this workspace+user). Returns null if the tag isn't theirs.
 */
export async function getCustomerDetailByTag(
  workspaceId: string,
  userId: string,
  tagId: string
): Promise<CustomerDetail | null> {
  const db = getDb();
  const tag = await db.query.contactTags.findFirst({
    where: and(
      eq(s.contactTags.id, tagId),
      eq(s.contactTags.workspaceId, workspaceId),
      eq(s.contactTags.userId, userId)
    ),
  });
  if (!tag) return null;
  const kind = tag.kind as 'email' | 'domain';
  const identifier = tag.identifier;

  // Email-vs-domain match predicates (identifier is stored lowercased).
  const senderMatch =
    kind === 'email'
      ? sql`lower(${s.inboxItems.senderEmail}) = ${identifier}`
      : sql`lower(split_part(${s.inboxItems.senderEmail}, '@', 2)) = ${identifier}`;
  const recipientMatch =
    kind === 'email'
      ? sql`lower(${s.inboxItems.recipientEmail}) = ${identifier}`
      : sql`lower(split_part(${s.inboxItems.recipientEmail}, '@', 2)) = ${identifier}`;
  const commitMatch =
    kind === 'email'
      ? sql`lower(${s.inboxCommitments.recipientEmail}) = ${identifier}`
      : sql`lower(split_part(${s.inboxCommitments.recipientEmail}, '@', 2)) = ${identifier}`;

  const [commitRows, threadRows, timelineRows] = await Promise.all([
    // Commitments (open + done), quote-guarded (Prompt 3 hallucination guard).
    db
      .select({
        id: s.inboxCommitments.id,
        promiseText: s.inboxCommitments.promiseText,
        sourceQuote: s.inboxCommitments.sourceQuote,
        dueAt: s.inboxCommitments.dueAt,
        dueBasis: s.inboxCommitments.dueBasis,
        confidence: s.inboxCommitments.confidence,
        status: s.inboxCommitments.status,
        sourceItemId: s.inboxCommitments.sourceItemId,
      })
      .from(s.inboxCommitments)
      .where(
        and(
          eq(s.inboxCommitments.workspaceId, workspaceId),
          eq(s.inboxCommitments.userId, userId),
          sql`${s.inboxCommitments.recipientEmail} is not null`,
          commitMatch,
          sql`${s.inboxCommitments.sourceQuote} is not null and length(trim(${s.inboxCommitments.sourceQuote})) > 0`,
          sql`${s.inboxCommitments.status} in ('open','done')`
        )
      )
      .orderBy(s.inboxCommitments.dueAt),
    // Inbound mail currently "braucht Antwort" (Prompt 1 gate).
    db
      .select({
        id: s.inboxItems.id,
        sourceId: s.inboxItems.sourceId,
        subject: s.inboxItems.subject,
        preview: s.inboxItems.preview,
        receivedAt: s.inboxItems.receivedAt,
      })
      .from(s.inboxItems)
      .where(
        and(
          eq(s.inboxItems.workspaceId, workspaceId),
          eq(s.inboxItems.userId, userId),
          eq(s.inboxItems.direction, 'inbox'),
          eq(s.inboxItems.isRead, false),
          eq(s.inboxItems.isArchived, false),
          sql`${s.inboxItems.category} in ('primary','customer')`,
          or(isNull(s.inboxItems.snoozedUntil), sql`${s.inboxItems.snoozedUntil} <= now()`)!,
          senderMatch
        )
      )
      .orderBy(s.inboxItems.receivedAt),
    // Interaction timeline — pure mail metadata, both directions.
    db
      .select({
        id: s.inboxItems.id,
        direction: s.inboxItems.direction,
        subject: s.inboxItems.subject,
        receivedAt: s.inboxItems.receivedAt,
        senderName: s.inboxItems.senderName,
        recipientEmail: s.inboxItems.recipientEmail,
      })
      .from(s.inboxItems)
      .where(
        and(
          eq(s.inboxItems.workspaceId, workspaceId),
          eq(s.inboxItems.userId, userId),
          or(
            and(eq(s.inboxItems.direction, 'inbox'), senderMatch),
            and(eq(s.inboxItems.direction, 'sent'), recipientMatch)
          )!
        )
      )
      .orderBy(desc(s.inboxItems.receivedAt))
      .limit(40),
  ]);

  const now = Date.now();
  const toCommitment = (r: (typeof commitRows)[number]): DetailCommitment => {
    const due = r.dueAt ? new Date(r.dueAt).getTime() : null;
    const overdueDays = due && due < now ? Math.floor((now - due) / DAY_MS) : null;
    const confidence = r.confidence as 'high' | 'medium' | 'low';
    return {
      id: r.id,
      promiseText: r.promiseText,
      // WHERE-guarded non-null/non-empty above; coalesce satisfies the type.
      sourceQuote: r.sourceQuote ?? '',
      dueAt: r.dueAt ? new Date(r.dueAt).toISOString() : null,
      dueBasis: r.dueBasis,
      overdueDays,
      confidence,
      isQuestion: confidence !== 'high',
      sourceItemId: r.sourceItemId,
    };
  };

  const openCommitments = commitRows.filter((r) => r.status === 'open').map(toCommitment);
  const doneCommitments = commitRows.filter((r) => r.status === 'done').map(toCommitment);

  const waitingThreads: DetailThread[] = threadRows.map((r) => ({
    id: r.id,
    sourceId: r.sourceId,
    subject: r.subject,
    preview: r.preview,
    receivedAt: new Date(r.receivedAt).toISOString(),
    waitingDays: Math.max(0, Math.floor((now - new Date(r.receivedAt).getTime()) / DAY_MS)),
  }));

  const timeline: DetailTimelineEntry[] = timelineRows.map((r) => ({
    id: r.id,
    direction: r.direction as 'inbox' | 'sent',
    subject: r.subject,
    receivedAt: new Date(r.receivedAt).toISOString(),
    who: r.direction === 'sent' ? (r.recipientEmail ?? 'Gesendet') : r.senderName,
  }));

  return {
    tagId: tag.id,
    kind,
    identifier,
    displayName: tag.displayName?.trim() || identifier,
    note: tag.note,
    openCommitments,
    doneCommitments,
    waitingThreads,
    timeline,
  };
}

// ── Manual contact detail (shared business contact) ──
//
// Same calm summary as a tagged client, but anchored on a customers row + its
// customer_contacts emails (multi-address). Per-user for commitments + "braucht
// Antwort" (those live in one member's inbox); the timeline is workspace-wide
// (with the member who interacted) so a team sees the shared history.

export type ManualContactEmail = { id: string; email: string };
export type TeamMember = { id: string; name: string; initials: string };
export type ContactNote = {
  id: string;
  text: string;
  createdAt: string;
  authorId: string | null;
  authorName: string | null;
  authorInitials: string | null;
};

export type ManualContactDetail = {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  status: string | null;
  note: string | null;
  emails: ManualContactEmail[];
  /** Optional team responsibility (a member) or null = beide/niemand. */
  assignedTo: TeamMember | null;
  /** Workspace members, for the assignment selector. */
  members: TeamMember[];
  /** Shared, chronological short updates both partners read + add. */
  notes: ContactNote[];
  openCommitments: DetailCommitment[];
  doneCommitments: DetailCommitment[];
  waitingThreads: DetailThread[];
  timeline: (DetailTimelineEntry & { byName: string | null })[];
};

export async function getManualContactDetail(
  workspaceId: string,
  userId: string,
  customerId: string
): Promise<ManualContactDetail | null> {
  const db = getDb();
  const customer = await db.query.customers.findFirst({
    // source='manual' guard: this view is for manually-created contacts only,
    // never the rental CRM's customers (defense-in-depth beyond the route gate).
    where: and(
      eq(s.customers.id, customerId),
      eq(s.customers.workspaceId, workspaceId),
      eq(s.customers.source, 'manual')
    ),
  });
  if (!customer) return null;

  const [contactRows, members, noteRows] = await Promise.all([
    db
      .select({ id: s.customerContacts.id, email: sql<string | null>`lower(${s.customerContacts.email})` })
      .from(s.customerContacts)
      .where(eq(s.customerContacts.customerId, customerId)),
    listWorkspaceMembers(workspaceId).catch(() => []),
    // Shared chronological updates (newest first), with the author's identity.
    db
      .select({
        id: s.contactNotes.id,
        text: s.contactNotes.text,
        createdAt: s.contactNotes.createdAt,
        authorId: s.contactNotes.authorId,
        authorName: s.users.name,
        authorInitials: s.users.initials,
      })
      .from(s.contactNotes)
      .leftJoin(s.users, eq(s.users.id, s.contactNotes.authorId))
      .where(
        and(
          eq(s.contactNotes.workspaceId, workspaceId),
          eq(s.contactNotes.customerId, customerId)
        )
      )
      .orderBy(desc(s.contactNotes.createdAt))
      .limit(100),
  ]);
  const emails = contactRows
    .filter((r): r is { id: string; email: string } => !!r.email)
    .map((r) => ({ id: r.id, email: r.email }));
  const emailList = emails.map((e) => e.email);

  const memberList: TeamMember[] = members.map((m) => ({ id: m.id, name: m.name, initials: m.initials }));
  const assignedTo: TeamMember | null = customer.assignedTo
    ? (memberList.find((m) => m.id === customer.assignedTo) ?? null)
    : null;
  const notes: ContactNote[] = noteRows.map((n) => ({
    id: n.id,
    text: n.text,
    createdAt: new Date(n.createdAt).toISOString(),
    authorId: n.authorId ?? null,
    authorName: n.authorName ?? null,
    authorInitials: n.authorInitials ?? null,
  }));

  const now = Date.now();
  const toCommitment = (r: {
    id: string; promiseText: string; sourceQuote: string | null; dueAt: Date | null;
    dueBasis: string | null; confidence: string; sourceItemId: string | null;
  }): DetailCommitment => {
    const due = r.dueAt ? new Date(r.dueAt).getTime() : null;
    const overdueDays = due && due < now ? Math.floor((now - due) / DAY_MS) : null;
    const confidence = r.confidence as 'high' | 'medium' | 'low';
    return {
      id: r.id,
      promiseText: r.promiseText,
      sourceQuote: r.sourceQuote ?? '',
      dueAt: r.dueAt ? new Date(r.dueAt).toISOString() : null,
      dueBasis: r.dueBasis,
      overdueDays,
      confidence,
      isQuestion: confidence !== 'high',
      sourceItemId: r.sourceItemId,
    };
  };

  // No emails yet → only the contact fields + collab data; nothing to attribute.
  if (emailList.length === 0) {
    return {
      id: customer.id,
      name: customer.name,
      company: customer.company,
      phone: customer.phone,
      status: customer.contactStatus,
      note: customer.notes || null,
      emails: [],
      assignedTo,
      members: memberList,
      notes,
      openCommitments: [],
      doneCommitments: [],
      waitingThreads: [],
      timeline: [],
    };
  }

  const [commitRows, threadRows, timelineRows] = await Promise.all([
    db
      .select({
        id: s.inboxCommitments.id,
        promiseText: s.inboxCommitments.promiseText,
        sourceQuote: s.inboxCommitments.sourceQuote,
        dueAt: s.inboxCommitments.dueAt,
        dueBasis: s.inboxCommitments.dueBasis,
        confidence: s.inboxCommitments.confidence,
        status: s.inboxCommitments.status,
        sourceItemId: s.inboxCommitments.sourceItemId,
      })
      .from(s.inboxCommitments)
      .where(
        and(
          eq(s.inboxCommitments.workspaceId, workspaceId),
          eq(s.inboxCommitments.userId, userId),
          inArray(sql`lower(${s.inboxCommitments.recipientEmail})`, emailList),
          sql`${s.inboxCommitments.sourceQuote} is not null and length(trim(${s.inboxCommitments.sourceQuote})) > 0`,
          sql`${s.inboxCommitments.status} in ('open','done')`
        )
      )
      .orderBy(s.inboxCommitments.dueAt),
    db
      .select({
        id: s.inboxItems.id,
        sourceId: s.inboxItems.sourceId,
        subject: s.inboxItems.subject,
        preview: s.inboxItems.preview,
        receivedAt: s.inboxItems.receivedAt,
      })
      .from(s.inboxItems)
      .where(
        and(
          eq(s.inboxItems.workspaceId, workspaceId),
          eq(s.inboxItems.userId, userId),
          eq(s.inboxItems.direction, 'inbox'),
          eq(s.inboxItems.isRead, false),
          eq(s.inboxItems.isArchived, false),
          sql`${s.inboxItems.category} in ('primary','customer')`,
          or(isNull(s.inboxItems.snoozedUntil), sql`${s.inboxItems.snoozedUntil} <= now()`)!,
          inArray(sql`lower(${s.inboxItems.senderEmail})`, emailList)
        )
      )
      .orderBy(s.inboxItems.receivedAt),
    // Timeline: workspace-wide (all members), with who interacted.
    db
      .select({
        id: s.inboxItems.id,
        direction: s.inboxItems.direction,
        subject: s.inboxItems.subject,
        receivedAt: s.inboxItems.receivedAt,
        senderName: s.inboxItems.senderName,
        recipientEmail: s.inboxItems.recipientEmail,
        byName: s.users.name,
      })
      .from(s.inboxItems)
      .leftJoin(s.users, eq(s.users.id, s.inboxItems.userId))
      .where(
        and(
          eq(s.inboxItems.workspaceId, workspaceId),
          or(
            and(eq(s.inboxItems.direction, 'inbox'), inArray(sql`lower(${s.inboxItems.senderEmail})`, emailList)),
            and(eq(s.inboxItems.direction, 'sent'), inArray(sql`lower(${s.inboxItems.recipientEmail})`, emailList))
          )!
        )
      )
      .orderBy(desc(s.inboxItems.receivedAt))
      .limit(40),
  ]);

  return {
    id: customer.id,
    name: customer.name,
    company: customer.company,
    phone: customer.phone,
    status: customer.contactStatus,
    note: customer.notes || null,
    emails,
    assignedTo,
    members: memberList,
    notes,
    openCommitments: commitRows.filter((r) => r.status === 'open').map(toCommitment),
    doneCommitments: commitRows.filter((r) => r.status === 'done').map(toCommitment),
    waitingThreads: threadRows.map((r) => ({
      id: r.id,
      sourceId: r.sourceId,
      subject: r.subject,
      preview: r.preview,
      receivedAt: new Date(r.receivedAt).toISOString(),
      waitingDays: Math.max(0, Math.floor((now - new Date(r.receivedAt).getTime()) / DAY_MS)),
    })),
    timeline: timelineRows.map((r) => ({
      id: r.id,
      direction: r.direction as 'inbox' | 'sent',
      subject: r.subject,
      receivedAt: new Date(r.receivedAt).toISOString(),
      who: r.direction === 'sent' ? (r.recipientEmail ?? 'Gesendet') : r.senderName,
      byName: r.byName ?? null,
    })),
  };
}
