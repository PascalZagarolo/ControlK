import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';
import type { GroupHealth } from '@/lib/types';

const DAY_MS = 86_400_000;

export async function getGroupHealthBatch(
  workspaceId: string
): Promise<Map<string, GroupHealth>> {
  const db = getDb();
  const out = new Map<string, GroupHealth>();

  const aggRows = await db.execute<{
    group_id: string;
    done7: string | number;
    avg_close_hours: string | null;
    open_total: string | number;
    open_stale: string | number;
  }>(sql`
    SELECT
      ${s.todos.groupId} AS group_id,
      COUNT(*) FILTER (
        WHERE ${s.todos.status} = 'erledigt'
        AND ${s.todos.completedAt} >= NOW() - INTERVAL '7 days'
      ) AS done7,
      AVG(EXTRACT(EPOCH FROM (${s.todos.completedAt} - ${s.todos.createdAt})) / 3600.0) FILTER (
        WHERE ${s.todos.status} = 'erledigt'
        AND ${s.todos.completedAt} >= NOW() - INTERVAL '30 days'
      ) AS avg_close_hours,
      COUNT(*) FILTER (
        WHERE ${s.todos.status} IN ('offen','in_arbeit')
      ) AS open_total,
      COUNT(*) FILTER (
        WHERE ${s.todos.status} IN ('offen','in_arbeit')
        AND ${s.todos.createdAt} < NOW() - INTERVAL '14 days'
      ) AS open_stale
    FROM ${s.todos}
    WHERE ${s.todos.workspaceId} = ${workspaceId}
      AND ${s.todos.groupId} IS NOT NULL
    GROUP BY ${s.todos.groupId};
  `);

  // PG result shape: rows array
  const aggList: any[] =
    Array.isArray((aggRows as any).rows) ? (aggRows as any).rows : (aggRows as any);

  for (const r of aggList) {
    const openTotal = Number(r.open_total ?? 0);
    const openStale = Number(r.open_stale ?? 0);
    out.set(r.group_id, {
      groupId: r.group_id,
      throughputLast7d: Number(r.done7 ?? 0),
      meanCloseHours: r.avg_close_hours != null ? Number(r.avg_close_hours) : null,
      staleRatio: openTotal > 0 ? openStale / openTotal : 0,
      spark: [0, 0, 0, 0, 0, 0, 0],
    });
  }

  // Sparkline: daily completion buckets for last 7 days
  const sparkRows = await db.execute<{
    group_id: string;
    day: string;
    n: string | number;
  }>(sql`
    SELECT
      ${s.todos.groupId} AS group_id,
      DATE_TRUNC('day', ${s.todos.completedAt}) AS day,
      COUNT(*) AS n
    FROM ${s.todos}
    WHERE ${s.todos.workspaceId} = ${workspaceId}
      AND ${s.todos.status} = 'erledigt'
      AND ${s.todos.completedAt} >= DATE_TRUNC('day', NOW() - INTERVAL '6 days')
      AND ${s.todos.groupId} IS NOT NULL
    GROUP BY ${s.todos.groupId}, day
    ORDER BY day ASC;
  `);
  const sparkList: any[] =
    Array.isArray((sparkRows as any).rows) ? (sparkRows as any).rows : (sparkRows as any);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayKeys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS);
    dayKeys.push(d.toISOString().slice(0, 10));
  }
  const bucketsByGroup = new Map<string, Map<string, number>>();
  for (const r of sparkList) {
    const key = new Date(r.day).toISOString().slice(0, 10);
    let m = bucketsByGroup.get(r.group_id);
    if (!m) {
      m = new Map();
      bucketsByGroup.set(r.group_id, m);
    }
    m.set(key, Number(r.n ?? 0));
  }
  for (const [groupId, buckets] of bucketsByGroup) {
    const spark = dayKeys.map((k) => buckets.get(k) ?? 0);
    const existing = out.get(groupId);
    if (existing) existing.spark = spark;
    else
      out.set(groupId, {
        groupId,
        throughputLast7d: spark.reduce((a, b) => a + b, 0),
        meanCloseHours: null,
        staleRatio: 0,
        spark,
      });
  }
  return out;
}
