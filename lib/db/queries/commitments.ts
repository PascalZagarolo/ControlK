import 'server-only';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';

export type CommitmentConfidence = 'high' | 'medium' | 'low';

export type OpenCommitment = {
  id: string;
  promiseText: string;
  dueAt: string | null;
  /** Verbatim deadline phrase the due date was derived from ("bis Freitag"). */
  dueBasis: string | null;
  overdueDays: number | null;
  recipientName: string | null;
  recipientEmail: string | null;
  customerId: string | null;
  customerName: string | null;
  sourceItemId: string | null;
  /**
   * Verbatim source sentence — explainability ("warum ist das hier") AND the
   * hallucination guard: rows without it are never returned (see the
   * NOT NULL filter below), so the UI can render every row's evidence.
   */
  sourceQuote: string;
  /** Only 'high' is shown as a hard "fällig"; lower → "bitte bestätigen". */
  confidence: CommitmentConfidence;
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
      dueBasis: s.inboxCommitments.dueBasis,
      recipientName: s.inboxCommitments.recipientName,
      recipientEmail: s.inboxCommitments.recipientEmail,
      customerId: s.inboxCommitments.customerId,
      sourceItemId: s.inboxCommitments.sourceItemId,
      sourceQuote: s.inboxCommitments.sourceQuote,
      confidence: s.inboxCommitments.confidence,
      customerName: s.customers.name,
    })
    .from(s.inboxCommitments)
    .leftJoin(s.customers, eq(s.customers.id, s.inboxCommitments.customerId))
    .where(
      and(
        eq(s.inboxCommitments.workspaceId, workspaceId),
        eq(s.inboxCommitments.userId, userId),
        eq(s.inboxCommitments.status, 'open'),
        // "Nicht heute": hide snoozed commitments until they wake.
        sql`(${s.inboxCommitments.snoozedUntil} is null or ${s.inboxCommitments.snoozedUntil} <= now())`,
        // Hallucination guard: never surface a commitment without its
        // verbatim source sentence. Legacy rows lacking one are hidden
        // rather than asserted. (Matches the "nie ohne source_sentence
        // anzeigen" rule.)
        sql`${s.inboxCommitments.sourceQuote} is not null and length(trim(${s.inboxCommitments.sourceQuote})) > 0`
      )
    )
    // High-confidence first (the hard "fällig" items lead), then overdue +
    // soonest; undated last. Lower-confidence "bitte bestätigen" sinks below.
    .orderBy(
      sql`case ${s.inboxCommitments.confidence} when 'high' then 0 when 'medium' then 1 else 2 end`,
      sql`${s.inboxCommitments.dueAt} ASC NULLS LAST`,
      asc(s.inboxCommitments.createdAt)
    )
    .limit(50);

  const now = Date.now();
  return rows.map((r) => {
    const due = r.dueAt ? new Date(r.dueAt).getTime() : null;
    return {
      id: r.id,
      promiseText: r.promiseText,
      dueAt: r.dueAt ? new Date(r.dueAt).toISOString() : null,
      dueBasis: r.dueBasis ?? null,
      overdueDays: due != null && due < now ? Math.floor((now - due) / 86_400_000) : null,
      recipientName: r.recipientName,
      recipientEmail: r.recipientEmail,
      customerId: r.customerId,
      customerName: r.customerName ?? null,
      sourceItemId: r.sourceItemId,
      // Non-null by construction (filtered in the WHERE above).
      sourceQuote: r.sourceQuote as string,
      confidence: (r.confidence ?? 'medium') as CommitmentConfidence,
    };
  });
}

/** Count of open commitments + how many are overdue (for the cockpit tile). */
/**
 * Counts for the morning plan. Only HIGH-confidence commitments count as real
 * obligations — tentative ("bitte bestätigen") ones are not asserted as facts,
 * matching the Promise Tracker UI and the trust model from Schritt 4a.
 */
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
        eq(s.inboxCommitments.status, 'open'),
        eq(s.inboxCommitments.confidence, 'high'),
        // Snoozed ("nicht heute") commitments don't inflate the plan counts.
        sql`(${s.inboxCommitments.snoozedUntil} is null or ${s.inboxCommitments.snoozedUntil} <= now())`,
        // Same hallucination guard as listOpenCommitments — a quote-less
        // row must not inflate the morning-plan counts either.
        sql`${s.inboxCommitments.sourceQuote} is not null and length(trim(${s.inboxCommitments.sourceQuote})) > 0`
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

// Default look-back for the incremental scan. Configurable via env so the
// first scan after connecting doesn't crawl the entire mailbox, and so ops
// can widen/narrow it without a deploy. Clamped to a sane range.
export const DEFAULT_SCAN_WINDOW_DAYS = (() => {
  const n = Number(process.env.COMMITMENT_SCAN_WINDOW_DAYS);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.max(Math.floor(n), 1), 120) : 30;
})();

/** Sent inbox items not yet scanned for commitments (most recent first). */
export async function listUnscannedSentItems(
  workspaceId: string,
  userId: string,
  limit: number,
  windowDays: number = DEFAULT_SCAN_WINDOW_DAYS
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
        sql`${s.inboxItems.receivedAt} >= now() - make_interval(days => ${windowDays})`
      )
    )
    .orderBy(sql`${s.inboxItems.receivedAt} DESC`)
    .limit(limit);
}
