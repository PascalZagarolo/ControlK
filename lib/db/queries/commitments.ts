import 'server-only';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';

export type OpenCommitment = {
  id: string;
  promiseText: string;
  dueAt: string | null;
  overdueDays: number | null;
  recipientName: string | null;
  recipientEmail: string | null;
  customerId: string | null;
  customerName: string | null;
  sourceItemId: string | null;
};

/** Open commitments (promises the user made), soonest/overdue first. */
export async function listOpenCommitments(
  workspaceId: string,
  userId: string
): Promise<OpenCommitment[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: s.inboxCommitments.id,
      promiseText: s.inboxCommitments.promiseText,
      dueAt: s.inboxCommitments.dueAt,
      recipientName: s.inboxCommitments.recipientName,
      recipientEmail: s.inboxCommitments.recipientEmail,
      customerId: s.inboxCommitments.customerId,
      sourceItemId: s.inboxCommitments.sourceItemId,
      customerName: s.customers.name,
    })
    .from(s.inboxCommitments)
    .leftJoin(s.customers, eq(s.customers.id, s.inboxCommitments.customerId))
    .where(
      and(
        eq(s.inboxCommitments.workspaceId, workspaceId),
        eq(s.inboxCommitments.userId, userId),
        eq(s.inboxCommitments.status, 'open')
      )
    )
    // Overdue + soonest first; undated commitments last.
    .orderBy(sql`${s.inboxCommitments.dueAt} ASC NULLS LAST`, asc(s.inboxCommitments.createdAt))
    .limit(50);

  const now = Date.now();
  return rows.map((r) => {
    const due = r.dueAt ? new Date(r.dueAt).getTime() : null;
    return {
      id: r.id,
      promiseText: r.promiseText,
      dueAt: r.dueAt ? new Date(r.dueAt).toISOString() : null,
      overdueDays: due != null && due < now ? Math.floor((now - due) / 86_400_000) : null,
      recipientName: r.recipientName,
      recipientEmail: r.recipientEmail,
      customerId: r.customerId,
      customerName: r.customerName ?? null,
      sourceItemId: r.sourceItemId,
    };
  });
}

/** Count of open commitments + how many are overdue (for the cockpit tile). */
export async function getCommitmentCounts(
  workspaceId: string,
  userId: string
): Promise<{ open: number; overdue: number }> {
  const db = getDb();
  const [row] = await db
    .select({
      open: sql<number>`count(*)::int`,
      overdue: sql<number>`count(*) filter (where ${s.inboxCommitments.dueAt} is not null and ${s.inboxCommitments.dueAt} < now())::int`,
    })
    .from(s.inboxCommitments)
    .where(
      and(
        eq(s.inboxCommitments.workspaceId, workspaceId),
        eq(s.inboxCommitments.userId, userId),
        eq(s.inboxCommitments.status, 'open')
      )
    );
  return { open: Number(row?.open ?? 0), overdue: Number(row?.overdue ?? 0) };
}

/**
 * Recent sent items REGARDLESS of scan state — powers the Schritt-0 dry-run
 * validation (measure extraction accuracy on real mail without touching the
 * persisted commitments or the scanned-marker).
 */
export async function listRecentSentItems(
  workspaceId: string,
  userId: string,
  limit: number,
  days: number
): Promise<{ id: string; sourceId: string; recipientEmail: string | null; subject: string | null; receivedAt: Date }[]> {
  const db = getDb();
  return db
    .select({
      id: s.inboxItems.id,
      sourceId: s.inboxItems.sourceId,
      recipientEmail: s.inboxItems.recipientEmail,
      subject: s.inboxItems.subject,
      receivedAt: s.inboxItems.receivedAt,
    })
    .from(s.inboxItems)
    .where(
      and(
        eq(s.inboxItems.workspaceId, workspaceId),
        eq(s.inboxItems.userId, userId),
        eq(s.inboxItems.direction, 'sent'),
        eq(s.inboxItems.sourceType, 'email_gmail'),
        sql`${s.inboxItems.receivedAt} >= now() - make_interval(days => ${days})`
      )
    )
    .orderBy(sql`${s.inboxItems.receivedAt} DESC`)
    .limit(limit);
}

/** Sent inbox items not yet scanned for commitments (most recent first). */
export async function listUnscannedSentItems(
  workspaceId: string,
  userId: string,
  limit: number
): Promise<{ id: string; sourceId: string; sourceThreadId: string | null; recipientEmail: string | null; subject: string | null; receivedAt: Date }[]> {
  const db = getDb();
  return db
    .select({
      id: s.inboxItems.id,
      sourceId: s.inboxItems.sourceId,
      sourceThreadId: s.inboxItems.sourceThreadId,
      recipientEmail: s.inboxItems.recipientEmail,
      subject: s.inboxItems.subject,
      receivedAt: s.inboxItems.receivedAt,
    })
    .from(s.inboxItems)
    .where(
      and(
        eq(s.inboxItems.workspaceId, workspaceId),
        eq(s.inboxItems.userId, userId),
        eq(s.inboxItems.direction, 'sent'),
        eq(s.inboxItems.sourceType, 'email_gmail'),
        isNull(s.inboxItems.commitmentsScannedAt),
        sql`${s.inboxItems.receivedAt} >= now() - interval '21 days'`
      )
    )
    .orderBy(sql`${s.inboxItems.receivedAt} DESC`)
    .limit(limit);
}
