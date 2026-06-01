import 'server-only';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';
import { resolveClient, type ClientMatch, type ContactTag } from '@/lib/clients/resolve';

// ─── Contact tags (lightweight per-user client marks) ───────────────

export type ContactTagRow = {
  id: string;
  kind: 'email' | 'domain';
  identifier: string;
  displayName: string | null;
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
