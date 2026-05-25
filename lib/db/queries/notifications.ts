import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';
import type { Notification } from '@/lib/types';

export async function listNotifications(
  userId: string,
  limit = 50,
  workspaceId?: string
): Promise<Notification[]> {
  const db = getDb();
  const where = workspaceId
    ? and(
        eq(s.notifications.userId, userId),
        eq(s.notifications.workspaceId, workspaceId)
      )
    : eq(s.notifications.userId, userId);
  const rows = await db.query.notifications.findMany({
    where,
    orderBy: [desc(s.notifications.createdAt)],
    limit,
    with: { /* author relation can be added later */ },
  });
  return rows.map(toNotification);
}

function toNotification(row: any): Notification {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    excerpt: row.excerpt ?? undefined,
    timestamp: row.createdAt.toISOString(),
    read: !!row.readAt,
    sourceUrl: row.sourceUrl,
  };
}
