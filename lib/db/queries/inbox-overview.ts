import 'server-only';
import { and, count, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';

export type InboxFilter = 'all' | 'unread' | 'archived';

export type InboxOverviewRow = {
  id: string;
  sourceType: string;
  senderName: string;
  senderEmail: string | null;
  subject: string | null;
  preview: string | null;
  receivedAt: string;
  isRead: boolean;
  isArchived: boolean;
};

export type InboxOverviewPage = {
  rows: InboxOverviewRow[];
  total: number;
  page: number;
  pageSize: number;
  filter: InboxFilter;
};

const DEFAULT_PAGE_SIZE = 50;

// Chronological list of inbox items, filtered + paginated. Snoozed
// items hide from "all" and "unread" (their owner explicitly deferred
// them); they DO surface in "archived" so the user can still find
// what they snoozed if they need to dig it up.
export async function listInboxItemsPaginated(
  workspaceId: string,
  opts: {
    filter?: InboxFilter;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<InboxOverviewPage> {
  const db = getDb();
  const filter = opts.filter ?? 'unread';
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;

  const conditions = [eq(s.inboxItems.workspaceId, workspaceId)];
  if (filter === 'unread') {
    conditions.push(eq(s.inboxItems.isRead, false));
    conditions.push(eq(s.inboxItems.isArchived, false));
    // Hide snoozed items unless they've woken up.
    conditions.push(
      or(
        isNull(s.inboxItems.snoozedUntil),
        sql`${s.inboxItems.snoozedUntil} <= now()`
      )!
    );
  } else if (filter === 'archived') {
    conditions.push(eq(s.inboxItems.isArchived, true));
  } else {
    // 'all' = not archived (everything else)
    conditions.push(eq(s.inboxItems.isArchived, false));
    conditions.push(
      or(
        isNull(s.inboxItems.snoozedUntil),
        sql`${s.inboxItems.snoozedUntil} <= now()`
      )!
    );
  }

  const where = and(...conditions);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: s.inboxItems.id,
        sourceType: s.inboxItems.sourceType,
        senderName: s.inboxItems.senderName,
        senderEmail: s.inboxItems.senderEmail,
        subject: s.inboxItems.subject,
        preview: s.inboxItems.preview,
        receivedAt: s.inboxItems.receivedAt,
        isRead: s.inboxItems.isRead,
        isArchived: s.inboxItems.isArchived,
      })
      .from(s.inboxItems)
      .where(where)
      .orderBy(desc(s.inboxItems.receivedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ n: count() })
      .from(s.inboxItems)
      .where(where),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      sourceType: r.sourceType,
      senderName: r.senderName,
      senderEmail: r.senderEmail,
      subject: r.subject,
      preview: r.preview,
      receivedAt: new Date(r.receivedAt).toISOString(),
      isRead: r.isRead,
      isArchived: r.isArchived,
    })),
    total: Number(totalRows[0]?.n ?? 0),
    page,
    pageSize,
    filter,
  };
}

// ── Awaiting split view ─────────────────────────────────────────

export type AwaitingRow = InboxOverviewRow & {
  /** For sent items: who we're waiting on. For inbox: null. */
  awaitingRecipient: string | null;
  /** Days since received_at — used to colour the row by urgency. */
  ageDays: number;
};

export type AwaitingSplit = {
  onYou: AwaitingRow[];
  onThem: AwaitingRow[];
};

/**
 * Split view powering "Auf dich wartet | Du wartest auf …".
 *
 * onYou: unread inbox items, capped at 20, newest first.
 * onThem: sent items where awaits_their_reply is true AND the message
 *         is at least AWAITING_GRACE_DAYS old (so brand-new sends
 *         don't count as overdue). Sorted oldest-first — the longer
 *         it's been, the more urgent.
 *
 * Both lists hide snoozed items.
 */
const AWAITING_GRACE_DAYS = 3;

export async function getAwaitingSplit(workspaceId: string): Promise<AwaitingSplit> {
  const db = getDb();
  const now = Date.now();

  const visibleClause = or(
    isNull(s.inboxItems.snoozedUntil),
    sql`${s.inboxItems.snoozedUntil} <= now()`
  )!;

  const [inboxRows, sentRows] = await Promise.all([
    db
      .select({
        id: s.inboxItems.id,
        sourceType: s.inboxItems.sourceType,
        senderName: s.inboxItems.senderName,
        senderEmail: s.inboxItems.senderEmail,
        recipientEmail: s.inboxItems.recipientEmail,
        subject: s.inboxItems.subject,
        preview: s.inboxItems.preview,
        receivedAt: s.inboxItems.receivedAt,
        isRead: s.inboxItems.isRead,
        isArchived: s.inboxItems.isArchived,
      })
      .from(s.inboxItems)
      .where(
        and(
          eq(s.inboxItems.workspaceId, workspaceId),
          eq(s.inboxItems.direction, 'inbox'),
          eq(s.inboxItems.isRead, false),
          eq(s.inboxItems.isArchived, false),
          visibleClause
        )
      )
      .orderBy(desc(s.inboxItems.receivedAt))
      .limit(20),
    db
      .select({
        id: s.inboxItems.id,
        sourceType: s.inboxItems.sourceType,
        senderName: s.inboxItems.senderName,
        senderEmail: s.inboxItems.senderEmail,
        recipientEmail: s.inboxItems.recipientEmail,
        subject: s.inboxItems.subject,
        preview: s.inboxItems.preview,
        receivedAt: s.inboxItems.receivedAt,
        isRead: s.inboxItems.isRead,
        isArchived: s.inboxItems.isArchived,
      })
      .from(s.inboxItems)
      .where(
        and(
          eq(s.inboxItems.workspaceId, workspaceId),
          eq(s.inboxItems.direction, 'sent'),
          eq(s.inboxItems.awaitsTheirReply, true),
          eq(s.inboxItems.isArchived, false),
          visibleClause,
          // Grace period — brand-new sends aren't overdue yet.
          sql`${s.inboxItems.receivedAt} < now() - interval '${sql.raw(String(AWAITING_GRACE_DAYS))} days'`
        )
      )
      .orderBy(s.inboxItems.receivedAt) // oldest first = most overdue at top
      .limit(20),
  ]);

  const toRow = (
    r: (typeof inboxRows)[number],
    asSent: boolean
  ): AwaitingRow => ({
    id: r.id,
    sourceType: r.sourceType,
    senderName: r.senderName,
    senderEmail: r.senderEmail,
    subject: r.subject,
    preview: r.preview,
    receivedAt: new Date(r.receivedAt).toISOString(),
    isRead: r.isRead,
    isArchived: r.isArchived,
    awaitingRecipient: asSent ? r.recipientEmail : null,
    ageDays: Math.floor((now - new Date(r.receivedAt).getTime()) / 86_400_000),
  });

  return {
    onYou: inboxRows.map((r) => toRow(r, false)),
    onThem: sentRows.map((r) => toRow(r, true)),
  };
}

// ── Group-by-Entity (Stack-by-Customer) ─────────────────────────

export type InboxGroup = {
  // Group key — customer.id when matched, otherwise sender_email-as-key.
  key: string;
  /** Customer match, when found. Falsy = unmatched person/sender. */
  customer: {
    id: string;
    name: string;
    initials: string;
    fromColor: string;
    toColor: string;
    status: string;
    openTodos: number;
    activeContracts: number;
  } | null;
  /** Display label — customer name when matched, else sender name/email. */
  label: string;
  /** Email-level subtitle (contact role / sender domain / etc.) */
  subtitle: string | null;
  totalCount: number;
  unreadCount: number;
  /** Most-recent received_at across the group's items, for sorting. */
  latestReceivedAt: string;
  /** Most-recent items in this group, capped for the expanded card. */
  items: InboxOverviewRow[];
};

/**
 * Stack-by-Entity view of the inbox. Aggregates non-archived items by
 * (customer | sender_email), enriches each group with the linked
 * customer's cached metrics, and returns groups sorted by recency.
 *
 * Heavy-ish query — we do GROUP BY in SQL for counts, then a second
 * pass to fetch the items per group. For workspaces with thousands of
 * senders we'd switch to lateral joins; for V1 this is fine.
 */
export async function groupInboxBySender(
  workspaceId: string,
  opts: { filter?: 'unread' | 'all'; max?: number } = {}
): Promise<InboxGroup[]> {
  const db = getDb();
  const filter = opts.filter ?? 'all';
  const maxGroups = opts.max ?? 30;

  // 1. Aggregate per sender_email.
  const baseConditions = [
    eq(s.inboxItems.workspaceId, workspaceId),
    eq(s.inboxItems.isArchived, false),
    or(
      isNull(s.inboxItems.snoozedUntil),
      sql`${s.inboxItems.snoozedUntil} <= now()`
    )!,
  ];
  if (filter === 'unread') {
    baseConditions.push(eq(s.inboxItems.isRead, false));
  }

  const aggregates = await db
    .select({
      senderEmail: s.inboxItems.senderEmail,
      senderName: sql<string>`max(${s.inboxItems.senderName})`,
      total: sql<number>`count(*)::int`,
      unread: sql<number>`sum(case when ${s.inboxItems.isRead} = false then 1 else 0 end)::int`,
      latest: sql<Date>`max(${s.inboxItems.receivedAt})`,
    })
    .from(s.inboxItems)
    .where(and(...baseConditions))
    .groupBy(s.inboxItems.senderEmail)
    .orderBy(sql`max(${s.inboxItems.receivedAt}) desc`)
    .limit(maxGroups);

  if (aggregates.length === 0) return [];

  // 2. Look up matching customers in one IN-query.
  const senderEmails = aggregates
    .map((a) => a.senderEmail)
    .filter((e): e is string => !!e);

  type CustomerMatch = {
    contactEmail: string;
    customerId: string;
    customerName: string;
    customerStatus: string;
    initials: string;
    fromColor: string;
    toColor: string;
    openTodos: number | null;
    activeContracts: number | null;
    contactRole: string | null;
  };
  let matches: CustomerMatch[] = [];
  if (senderEmails.length > 0) {
    matches = await db
      .select({
        contactEmail: sql<string>`lower(${s.customerContacts.email})`,
        customerId: s.customers.id,
        customerName: s.customers.name,
        customerStatus: s.customers.status,
        initials: s.customers.initials,
        fromColor: s.customers.fromColor,
        toColor: s.customers.toColor,
        openTodos: s.customers.cachedOpenTodoCount,
        activeContracts: s.customers.cachedActiveContractCount,
        contactRole: s.customerContacts.role,
      })
      .from(s.customerContacts)
      .innerJoin(s.customers, eq(s.customers.id, s.customerContacts.customerId))
      .where(
        and(
          eq(s.customers.workspaceId, workspaceId),
          sql`lower(${s.customerContacts.email}) in (${sql.join(
            senderEmails.map((e) => sql`lower(${e})`),
            sql`, `
          )})`
        )
      );
  }
  const byEmail = new Map(matches.map((m) => [m.contactEmail, m]));

  // 3. Fetch up-to-5 most-recent items per group. Single query, then
  // bucket in code. (Window-functions would be cleaner but Drizzle's
  // surface for them is awkward.)
  const itemRows = await db
    .select({
      id: s.inboxItems.id,
      sourceType: s.inboxItems.sourceType,
      senderName: s.inboxItems.senderName,
      senderEmail: s.inboxItems.senderEmail,
      subject: s.inboxItems.subject,
      preview: s.inboxItems.preview,
      receivedAt: s.inboxItems.receivedAt,
      isRead: s.inboxItems.isRead,
      isArchived: s.inboxItems.isArchived,
    })
    .from(s.inboxItems)
    .where(
      and(
        ...baseConditions,
        sql`${s.inboxItems.senderEmail} in (${sql.join(
          senderEmails.map((e) => sql`${e}`),
          sql`, `
        )})`
      )
    )
    .orderBy(desc(s.inboxItems.receivedAt))
    .limit(maxGroups * 5);

  const bucketedItems = new Map<string, InboxOverviewRow[]>();
  for (const r of itemRows) {
    const key = r.senderEmail ?? '__nokey__';
    const list = bucketedItems.get(key) ?? [];
    if (list.length >= 5) continue;
    list.push({
      id: r.id,
      sourceType: r.sourceType,
      senderName: r.senderName,
      senderEmail: r.senderEmail,
      subject: r.subject,
      preview: r.preview,
      receivedAt: new Date(r.receivedAt).toISOString(),
      isRead: r.isRead,
      isArchived: r.isArchived,
    });
    bucketedItems.set(key, list);
  }

  // 4. Compose groups.
  return aggregates.map<InboxGroup>((agg) => {
    const emailKey = (agg.senderEmail ?? '').toLowerCase();
    const match = emailKey ? byEmail.get(emailKey) : undefined;
    const items = bucketedItems.get(agg.senderEmail ?? '__nokey__') ?? [];
    return {
      key: match ? `c:${match.customerId}` : `s:${emailKey || agg.senderName}`,
      customer: match
        ? {
            id: match.customerId,
            name: match.customerName,
            initials: match.initials,
            fromColor: match.fromColor,
            toColor: match.toColor,
            status: match.customerStatus,
            openTodos: match.openTodos ?? 0,
            activeContracts: match.activeContracts ?? 0,
          }
        : null,
      label: match ? match.customerName : agg.senderName,
      subtitle: match
        ? match.contactRole
          ? `${agg.senderName} · ${match.contactRole}`
          : agg.senderName
        : agg.senderEmail ?? null,
      totalCount: Number(agg.total ?? 0),
      unreadCount: Number(agg.unread ?? 0),
      latestReceivedAt: new Date(agg.latest).toISOString(),
      items,
    };
  });
}
