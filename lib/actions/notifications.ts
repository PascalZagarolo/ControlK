'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { getDb, hasDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';

export async function markNotificationRead(id: string) {
  if (!hasDb()) return { ok: false as const, error: 'Database not configured.' };
  const user = await requireUser();
  const db = getDb();
  await db
    .update(s.notifications)
    .set({ readAt: new Date() })
    .where(and(eq(s.notifications.id, id), eq(s.notifications.userId, user.id)));
  return { ok: true as const };
}

export async function markAllNotificationsRead() {
  if (!hasDb()) return { ok: false as const, error: 'Database not configured.' };
  const user = await requireUser();
  const db = getDb();
  await db
    .update(s.notifications)
    .set({ readAt: new Date() })
    .where(and(eq(s.notifications.userId, user.id), isNull(s.notifications.readAt)));
  return { ok: true as const };
}
