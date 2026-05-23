import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';
import type { Notification } from '@/lib/types';

export async function listNotifications(userId: string, limit = 50): Promise<Notification[]> {
  const db = getDb();
  const rows = await db.query.notifications.findMany({
    where: eq(s.notifications.userId, userId),
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
