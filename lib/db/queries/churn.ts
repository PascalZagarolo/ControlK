import 'server-only';

import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';

/**
 * Churn risk — a customer who used to write regularly has gone quiet.
 * Pure SQL over the inbox mirror: we match inbound mails to customers via
 * their contact emails, derive each customer's typical reply cadence from
 * their own message history, and flag those whose silence now far exceeds
 * that cadence. No new tables, no AI — just the chronology we already store.
 */
export type ChurnAlert = {
  customerId: string;
  customerName: string;
  customerSlug: string;
  msgCount: number;
  /** Whole days since their last inbound message. */
  daysSinceLast: number;
  /** Their historical average gap between messages, in days. */
  avgIntervalDays: number;
  /** daysSinceLast / avgIntervalDays — how many "normal cycles" of silence. */
  silenceRatio: number;
  lastAt: string;
};

// A customer must have written at least this often to have a meaningful
// cadence — below this, a gap is noise, not churn.
const MIN_MESSAGES = 3;
// Don't cry wolf for short gaps even on chatty customers.
const MIN_SILENCE_DAYS = 10;
// Silence must exceed this multiple of their normal cadence to qualify.
const SILENCE_MULTIPLIER = 2;

export async function getChurnAlerts(
  workspaceId: string,
  limit = 8
): Promise<ChurnAlert[]> {
  const db = getDb();
  const rows = await db.execute<{
    customer_id: string;
    customer_name: string;
    customer_slug: string;
    msg_count: number | string;
    days_since_last: number | string;
    avg_interval_days: number | string;
    silence_ratio: number | string;
    last_at: string | Date;
  }>(sql`
    WITH msgs AS (
      -- DISTINCT so a customer with the same email on multiple contact rows
      -- doesn't double-count a single inbound mail (which would skew cadence).
      SELECT DISTINCT c.id AS customer_id, c.name AS customer_name,
             c.slug AS customer_slug, i.id AS item_id, i.received_at
      FROM ${s.inboxItems} i
      JOIN ${s.customerContacts} cc ON lower(cc.email) = lower(i.sender_email)
      JOIN ${s.customers} c ON c.id = cc.customer_id
      WHERE i.workspace_id = ${workspaceId}
        AND c.workspace_id = ${workspaceId}
        AND i.direction = 'inbox'
        AND i.sender_email IS NOT NULL
        AND i.sender_email <> ''
    ),
    agg AS (
      SELECT customer_id, customer_name, customer_slug,
             count(*)::int AS msg_count,
             max(received_at) AS last_at,
             EXTRACT(EPOCH FROM (now() - max(received_at))) / 86400.0 AS days_since_last,
             EXTRACT(EPOCH FROM (max(received_at) - min(received_at))) / 86400.0 AS span_days
      FROM msgs
      GROUP BY customer_id, customer_name, customer_slug
    )
    SELECT customer_id, customer_name, customer_slug, msg_count, last_at,
           days_since_last,
           (span_days / NULLIF(msg_count - 1, 0)) AS avg_interval_days,
           days_since_last / NULLIF(span_days / NULLIF(msg_count - 1, 0), 0) AS silence_ratio
    FROM agg
    WHERE msg_count >= ${MIN_MESSAGES}
      AND span_days > 0
      AND days_since_last >= ${MIN_SILENCE_DAYS}
      AND days_since_last > (span_days / NULLIF(msg_count - 1, 0)) * ${SILENCE_MULTIPLIER}
    ORDER BY silence_ratio DESC
    LIMIT ${limit}
  `);

  const list: any[] = Array.isArray((rows as any).rows)
    ? (rows as any).rows
    : (rows as any);

  return list.map((r) => ({
    customerId: r.customer_id,
    customerName: r.customer_name,
    customerSlug: r.customer_slug,
    msgCount: Number(r.msg_count),
    daysSinceLast: Math.round(Number(r.days_since_last)),
    avgIntervalDays: Math.round(Number(r.avg_interval_days) * 10) / 10,
    silenceRatio: Math.round(Number(r.silence_ratio) * 10) / 10,
    lastAt: new Date(r.last_at).toISOString(),
  }));
}
