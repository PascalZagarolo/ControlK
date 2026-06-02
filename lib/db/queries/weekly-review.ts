import 'server-only';
import { and, eq, gte, lt, desc, asc, sql } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';

// Weekly review ("Zusagen gehalten / gekippt") — the calm Friday/Sunday recap
// that closes the loop the morning plan opens. All COMPUTED from commitments +
// sent mail; nothing maintained. Quote-guarded like every commitment surface.

const WEEK_MS = 7 * 86_400_000;
const DAY_MS = 86_400_000;
const QUOTE_GUARD = (col: typeof s.inboxCommitments.sourceQuote) =>
  sql`${col} is not null and length(trim(${col})) > 0`;

export type ReviewCommitment = {
  id: string;
  promiseText: string;
  who: string | null;
  resolvedAt: string | null;
  dueAt: string | null;
  overdueDays: number | null;
};

export type WeeklyReview = {
  /** Commitments resolved (done) in the last 7 days — "gehalten". */
  held: ReviewCommitment[];
  heldCount: number;
  /** Open commitments already past due now — "kippt / überfällig". */
  slipping: ReviewCommitment[];
  slippingCount: number;
  /** Replies you sent in the last 7 days (mail metadata). */
  repliesSent: number;
  /** New commitments detected in the last 7 days (context). */
  newPromises: number;
};

export async function getWeeklyReview(workspaceId: string, userId: string): Promise<WeeklyReview> {
  const db = getDb();
  const now = Date.now();
  const since = new Date(now - WEEK_MS);

  const base = and(
    eq(s.inboxCommitments.workspaceId, workspaceId),
    eq(s.inboxCommitments.userId, userId),
    QUOTE_GUARD(s.inboxCommitments.sourceQuote)
  );

  const cols = {
    id: s.inboxCommitments.id,
    promiseText: s.inboxCommitments.promiseText,
    recipientName: s.inboxCommitments.recipientName,
    customerName: s.customers.name,
    resolvedAt: s.inboxCommitments.resolvedAt,
    dueAt: s.inboxCommitments.dueAt,
  };

  const heldWhere = and(base, eq(s.inboxCommitments.status, 'done'), gte(s.inboxCommitments.resolvedAt, since));
  const slippingWhere = and(
    base,
    eq(s.inboxCommitments.status, 'open'),
    lt(s.inboxCommitments.dueAt, new Date(now)),
    sql`(${s.inboxCommitments.snoozedUntil} is null or ${s.inboxCommitments.snoozedUntil} <= now())`
  );

  const [heldRows, slippingRows, sentRow, newRow, heldCountRow, slippingCountRow] = await Promise.all([
    // Gehalten: done + resolved within the window.
    db
      .select(cols)
      .from(s.inboxCommitments)
      .leftJoin(s.customers, eq(s.customers.id, s.inboxCommitments.customerId))
      .where(heldWhere)
      .orderBy(desc(s.inboxCommitments.resolvedAt))
      .limit(50),
    // Kippt: still open + already overdue (snoozed ones excluded — they're deferred).
    db
      .select(cols)
      .from(s.inboxCommitments)
      .leftJoin(s.customers, eq(s.customers.id, s.inboxCommitments.customerId))
      .where(slippingWhere)
      .orderBy(asc(s.inboxCommitments.dueAt))
      .limit(50),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.inboxItems)
      .where(
        and(
          eq(s.inboxItems.workspaceId, workspaceId),
          eq(s.inboxItems.userId, userId),
          eq(s.inboxItems.direction, 'sent'),
          gte(s.inboxItems.receivedAt, since)
        )
      ),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.inboxCommitments)
      .where(and(base, gte(s.inboxCommitments.createdAt, since))),
    db.select({ n: sql<number>`count(*)::int` }).from(s.inboxCommitments).where(heldWhere),
    db.select({ n: sql<number>`count(*)::int` }).from(s.inboxCommitments).where(slippingWhere),
  ]);

  const toReview = (r: (typeof heldRows)[number]): ReviewCommitment => {
    const due = r.dueAt ? new Date(r.dueAt).getTime() : null;
    return {
      id: r.id,
      promiseText: r.promiseText,
      who: r.customerName ?? r.recipientName ?? null,
      resolvedAt: r.resolvedAt ? new Date(r.resolvedAt).toISOString() : null,
      dueAt: r.dueAt ? new Date(r.dueAt).toISOString() : null,
      overdueDays: due && due < now ? Math.floor((now - due) / DAY_MS) : null,
    };
  };

  return {
    held: heldRows.map(toReview),
    heldCount: Number(heldCountRow[0]?.n ?? heldRows.length),
    slipping: slippingRows.map(toReview),
    slippingCount: Number(slippingCountRow[0]?.n ?? slippingRows.length),
    repliesSent: Number(sentRow[0]?.n ?? 0),
    newPromises: Number(newRow[0]?.n ?? 0),
  };
}
