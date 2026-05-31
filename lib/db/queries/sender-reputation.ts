import 'server-only';

import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';

/**
 * Sender Reputation — who actually matters in your inbox, derived from how
 * YOU behave toward them. Pure SQL over the thread chronology: for every
 * inbound sender we measure how often you reply, how fast, and how much they
 * write, then fold that into a 0–100 score. The people you consistently
 * answer quickly bubble to the top; cold lists sink. No AI, no extra tables.
 */
export type SenderReputation = {
  senderEmail: string;
  senderName: string;
  msgCount: number;
  replyRate: number; // 0..1 — share of their threads you replied to
  avgResponseHours: number | null; // null when you never replied
  customerId: string | null;
  customerName: string | null;
  lastAt: string;
  score: number; // 0..100 composite importance
  vip: boolean;
};

type Row = {
  sender_email: string;
  sender_name: string | null;
  msg_count: number | string;
  replied_count: number | string;
  avg_response_hours: number | string | null;
  customer_id: string | null;
  customer_name: string | null;
  last_at: string | Date;
};

// You must have received at least this many before a reputation is meaningful.
const MIN_MESSAGES = 2;

function scoreOf(r: {
  msgCount: number;
  replyRate: number;
  avgResponseHours: number | null;
  isCustomer: boolean;
}): number {
  const replyScore = r.replyRate; // 0..1
  const speedScore =
    r.avgResponseHours == null ? 0 : Math.max(0, 1 - r.avgResponseHours / 48);
  const volumeScore = Math.min(r.msgCount / 10, 1);
  const customerBonus = r.isCustomer ? 0.2 : 0;
  const raw =
    0.35 * replyScore + 0.25 * speedScore + 0.25 * volumeScore + customerBonus;
  return Math.max(0, Math.min(100, Math.round(raw * 100)));
}

export async function getSenderReputations(
  workspaceId: string,
  limit = 6
): Promise<SenderReputation[]> {
  const db = getDb();
  const rows = await db.execute<Row>(sql`
    WITH inbound AS (
      SELECT id, lower(sender_email) AS sender_email, source_thread_id, received_at
      FROM ${s.inboxItems}
      WHERE workspace_id = ${workspaceId}
        AND direction = 'inbox'
        AND sender_email IS NOT NULL
        AND sender_email <> ''
        AND source_thread_id IS NOT NULL
    ),
    replied AS (
      SELECT ib.sender_email, ib.received_at,
        (SELECT min(st.received_at) FROM ${s.inboxItems} st
           WHERE st.workspace_id = ${workspaceId}
             AND st.direction = 'sent'
             AND st.source_thread_id = ib.source_thread_id
             AND st.received_at > ib.received_at) AS first_reply_at
      FROM inbound ib
    ),
    per_sender AS (
      SELECT sender_email,
        count(*)::int AS msg_count,
        count(first_reply_at)::int AS replied_count,
        avg(EXTRACT(EPOCH FROM (first_reply_at - received_at)) / 3600.0)
          FILTER (WHERE first_reply_at IS NOT NULL) AS avg_response_hours,
        max(received_at) AS last_at
      FROM replied
      GROUP BY sender_email
      HAVING count(*) >= ${MIN_MESSAGES}
    )
    SELECT ps.sender_email, ps.msg_count, ps.replied_count,
           ps.avg_response_hours, ps.last_at,
           name_pick.sender_name,
           cust.customer_id, cust.customer_name
    FROM per_sender ps
    LEFT JOIN LATERAL (
      SELECT x.sender_name FROM ${s.inboxItems} x
      WHERE x.workspace_id = ${workspaceId} AND lower(x.sender_email) = ps.sender_email
      ORDER BY x.received_at DESC LIMIT 1
    ) name_pick ON true
    LEFT JOIN LATERAL (
      SELECT c.id AS customer_id, c.name AS customer_name
      FROM ${s.customerContacts} cc
      JOIN ${s.customers} c ON c.id = cc.customer_id AND c.workspace_id = ${workspaceId}
      WHERE lower(cc.email) = ps.sender_email
      LIMIT 1
    ) cust ON true
  `);

  const list: any[] = Array.isArray((rows as any).rows)
    ? (rows as any).rows
    : (rows as any);

  return list
    .map((r: Row) => {
      const msgCount = Number(r.msg_count);
      const repliedCount = Number(r.replied_count);
      const replyRate = msgCount > 0 ? repliedCount / msgCount : 0;
      const avgResponseHours =
        r.avg_response_hours == null
          ? null
          : Math.round(Number(r.avg_response_hours) * 10) / 10;
      const customerId = r.customer_id ?? null;
      const score = scoreOf({
        msgCount,
        replyRate,
        avgResponseHours,
        isCustomer: !!customerId,
      });
      return {
        senderEmail: r.sender_email,
        senderName: cleanName(r.sender_name) || r.sender_email,
        msgCount,
        replyRate: Math.round(replyRate * 100) / 100,
        avgResponseHours,
        customerId,
        customerName: r.customer_name ?? null,
        lastAt: new Date(r.last_at).toISOString(),
        score,
        vip: score >= 65,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function cleanName(raw: string | null): string {
  if (!raw) return '';
  const m = raw.match(/^(.*)<[^>]+>\s*$/);
  if (m) return m[1].trim().replace(/^["']|["']$/g, '') || raw;
  return raw;
}
