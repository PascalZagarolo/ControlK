import 'server-only';
import { and, count, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';

export type InboxFilter = 'all' | 'unread' | 'archived';
export type InboxRange = 'today' | 'week';

export type InboxRangeItem = {
  senderName: string;
  subject: string | null;
  preview: string | null;
  category: InboxCategoryKey;
  receivedAt: string;
};

/**
 * Compact item list for the time-range AI digest ("Heute" / "Diese Woche").
 * Incoming, non-archived, non-future-snoozed items in the range — with
 * category + preview so the model can say things like "Dein DHL-Paket
 * kommt heute" or "Vier Kunden haben sich gemeldet".
 */
export async function getInboxRangeItems(
  workspaceId: string,
  userId: string,
  range: InboxRange
): Promise<InboxRangeItem[]> {
  const db = getDb();
  const since =
    range === 'today'
      ? sql`date_trunc('day', now())`
      : sql`date_trunc('week', now())`;
  const rows = await db
    .select({
      senderName: s.inboxItems.senderName,
      subject: s.inboxItems.subject,
      preview: s.inboxItems.preview,
      category: s.inboxItems.category,
      receivedAt: s.inboxItems.receivedAt,
    })
    .from(s.inboxItems)
    .where(
      and(
        eq(s.inboxItems.workspaceId, workspaceId),
        eq(s.inboxItems.userId, userId),
        eq(s.inboxItems.direction, 'inbox'),
        eq(s.inboxItems.isArchived, false),
        sql`${s.inboxItems.receivedAt} >= ${since}`
      )
    )
    .orderBy(desc(s.inboxItems.receivedAt))
    .limit(60);
  return rows.map((r) => ({
    senderName: r.senderName,
    subject: r.subject,
    preview: r.preview,
    category: r.category as InboxCategoryKey,
    receivedAt: new Date(r.receivedAt).toISOString(),
  }));
}

export type InboxCategoryKey =
  | 'primary'
  | 'customer'
  | 'shipping'
  | 'promo'
  | 'social'
  | 'updates'
  | 'forums';

export type InboxCounts = {
  total: number;
  byCategory: Record<InboxCategoryKey, number>;
  topics: { topic: string; count: number }[];
};

/**
 * Sidebar counts. Counts non-archived, non-snoozed inbox items per
 * category, plus AI-derived topic buckets. Topics aggregate via JOIN
 * to sender_topics on domain (extracted from sender_email).
 *
 * Scoped to the current user — other members of a shared workspace
 * have their own counts and topics.
 */
export async function getInboxCounts(
  workspaceId: string,
  userId: string
): Promise<InboxCounts> {
  const db = getDb();
  const visibleClause = or(
    isNull(s.inboxItems.snoozedUntil),
    sql`${s.inboxItems.snoozedUntil} <= now()`
  )!;
  const baseWhere = and(
    eq(s.inboxItems.workspaceId, workspaceId),
    eq(s.inboxItems.userId, userId),
    eq(s.inboxItems.isArchived, false),
    visibleClause
  );

  const [categoryRows, topicRows, totalRow] = await Promise.all([
    db
      .select({
        category: s.inboxItems.category,
        n: sql<number>`count(*)::int`,
      })
      .from(s.inboxItems)
      .where(baseWhere)
      .groupBy(s.inboxItems.category),
    db
      .select({
        topic: s.senderTopics.topic,
        n: sql<number>`count(*)::int`,
      })
      .from(s.inboxItems)
      .innerJoin(
        s.senderTopics,
        and(
          eq(s.senderTopics.workspaceId, s.inboxItems.workspaceId),
          sql`${s.senderTopics.domain} = lower(split_part(${s.inboxItems.senderEmail}, '@', 2))`
        )
      )
      .where(baseWhere)
      .groupBy(s.senderTopics.topic)
      .orderBy(sql`count(*) desc`)
      .limit(15),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.inboxItems)
      .where(baseWhere),
  ]);

  const byCategory: Record<InboxCategoryKey, number> = {
    primary: 0,
    customer: 0,
    shipping: 0,
    promo: 0,
    social: 0,
    updates: 0,
    forums: 0,
  };
  for (const r of categoryRows) {
    byCategory[r.category as InboxCategoryKey] = Number(r.n);
  }

  return {
    total: Number(totalRow[0]?.n ?? 0),
    byCategory,
    topics: topicRows.map((r) => ({ topic: r.topic, count: Number(r.n) })),
  };
}

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
//
// category + topic filters cascade through every mode (list/group/
// awaiting). topic is a JOIN against sender_topics on the email's
// domain — sql split_part keeps it server-side, no client mapping.
export async function listInboxItemsPaginated(
  workspaceId: string,
  userId: string,
  opts: {
    filter?: InboxFilter;
    page?: number;
    pageSize?: number;
    category?: InboxCategoryKey | null;
    topic?: string | null;
    range?: InboxRange | null;
  } = {}
): Promise<InboxOverviewPage> {
  const db = getDb();
  const filter = opts.filter ?? 'unread';
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;

  const conditions = [
    eq(s.inboxItems.workspaceId, workspaceId),
    eq(s.inboxItems.userId, userId),
  ];
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

  if (opts.category) {
    conditions.push(eq(s.inboxItems.category, opts.category));
  }
  if (opts.range === 'today') {
    conditions.push(sql`${s.inboxItems.receivedAt} >= date_trunc('day', now())`);
  } else if (opts.range === 'week') {
    conditions.push(sql`${s.inboxItems.receivedAt} >= date_trunc('week', now())`);
  }

  const where = and(...conditions);

  // Topic filter requires a JOIN to sender_topics on extracted domain.
  // Built as a separate where-fragment that gets ANDed into the query
  // both for the list select and the COUNT.
  const topicJoinCondition = opts.topic
    ? and(
        eq(s.senderTopics.workspaceId, s.inboxItems.workspaceId),
        sql`${s.senderTopics.domain} = lower(split_part(${s.inboxItems.senderEmail}, '@', 2))`,
        eq(s.senderTopics.topic, opts.topic)
      )
    : null;

  const baseSelect = db
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
    .from(s.inboxItems);

  const baseCount = db
    .select({ n: count() })
    .from(s.inboxItems);

  const [rows, totalRows] = await Promise.all([
    (topicJoinCondition
      ? baseSelect.innerJoin(s.senderTopics, topicJoinCondition)
      : baseSelect
    )
      .where(where)
      .orderBy(desc(s.inboxItems.receivedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    (topicJoinCondition
      ? baseCount.innerJoin(s.senderTopics, topicJoinCondition)
      : baseCount
    ).where(where),
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

// Triage hard-rule (Schritt 1, "Chrono24-Problem"): only genuine 1:1
// correspondence counts as "needs a reply". Marketing/order-status/social/
// list mail (promo, updates, social, shipping, forums) is informational and
// must never inflate the morning plan's "auf dich wartet" count.
const awaitingCategoryClause = sql`${s.inboxItems.category} in ('primary','customer')`;

export async function getAwaitingSplit(
  workspaceId: string,
  userId: string
): Promise<AwaitingSplit> {
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
          eq(s.inboxItems.userId, userId),
          eq(s.inboxItems.direction, 'inbox'),
          eq(s.inboxItems.isRead, false),
          eq(s.inboxItems.isArchived, false),
          awaitingCategoryClause,
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
          eq(s.inboxItems.userId, userId),
          eq(s.inboxItems.direction, 'sent'),
          eq(s.inboxItems.awaitsTheirReply, true),
          eq(s.inboxItems.isArchived, false),
          awaitingCategoryClause,
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
  userId: string,
  opts: { filter?: 'unread' | 'all'; max?: number; customerOnly?: boolean } = {}
): Promise<InboxGroup[]> {
  const db = getDb();
  const filter = opts.filter ?? 'all';
  const maxGroups = opts.max ?? 30;

  // 1. Aggregate per sender_email.
  const baseConditions = [
    eq(s.inboxItems.workspaceId, workspaceId),
    eq(s.inboxItems.userId, userId),
    eq(s.inboxItems.isArchived, false),
    or(
      isNull(s.inboxItems.snoozedUntil),
      sql`${s.inboxItems.snoozedUntil} <= now()`
    )!,
  ];
  if (filter === 'unread') {
    baseConditions.push(eq(s.inboxItems.isRead, false));
  }
  // "Von Kunden": restrict to senders that ARE known customer contacts BEFORE
  // the maxGroups cap — otherwise the cap (30 most-recent senders) could be
  // entirely non-customers and the customer-only view would wrongly look empty.
  if (opts.customerOnly) {
    baseConditions.push(
      sql`lower(${s.inboxItems.senderEmail}) in (
        select lower(${s.customerContacts.email})
        from ${s.customerContacts}
        join ${s.customers} on ${s.customers.id} = ${s.customerContacts.customerId}
        where ${s.customers.workspaceId} = ${workspaceId}
          and ${s.customerContacts.email} is not null
      )`
    );
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
  const composed = aggregates.map<InboxGroup>((agg) => {
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

  // "Von Kunden" view: keep only groups that resolved to a known customer.
  // Note: the maxGroups cap is applied to aggregates BEFORE this filter, so a
  // workspace with many non-customer senders may surface few customer groups —
  // acceptable for V1; a customer-first aggregate query is the later refinement.
  return opts.customerOnly ? composed.filter((g) => g.customer != null) : composed;
}
