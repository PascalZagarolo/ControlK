'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import {
  backfillActivityLog,
  computeThresholdsForUser,
  detectStandstillsForUser,
} from '@/lib/inverse/engine';

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * One-shot bootstrap: walk all historical data, populate activity_log,
 * compute thresholds, detect standstills. Triggered from the Inverse
 * view's empty state. Idempotent — safe to re-run.
 */
export async function bootstrapInverseCalendar(): Promise<
  Result<{
    activity: number;
    entities: number;
    entered: number;
  }>
> {
  const user = await requireUser();
  const counts = await backfillActivityLog(user.id);
  const activityTotal =
    counts.calendarEvents +
    counts.inboxItems +
    counts.channelMessages +
    counts.noteMentions;
  const t = await computeThresholdsForUser(user.id);
  const d = await detectStandstillsForUser(user.id);
  revalidatePath('/calendar/inverse');
  return {
    ok: true,
    activity: activityTotal,
    entities: t.entities,
    entered: d.entered,
  };
}

async function authorizeThreshold(
  thresholdId: string
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const user = await requireUser();
  const db = getDb();
  const row = await db.query.entityThresholds.findFirst({
    where: and(
      eq(s.entityThresholds.id, thresholdId),
      eq(s.entityThresholds.userId, user.id)
    ),
    columns: { id: true },
  });
  if (!row) return { ok: false, error: 'Entität nicht gefunden.' };
  return { ok: true, userId: user.id };
}

export async function snoozeStandstill(
  thresholdId: string,
  days: number
): Promise<Result> {
  const auth = await authorizeThreshold(thresholdId);
  if (!auth.ok) return auth;
  const until = new Date(Date.now() + days * 86_400_000);
  const db = getDb();
  await db
    .update(s.entityThresholds)
    .set({
      mutedUntil: until,
      isInStandstill: false,
      standstillSince: null,
      updatedAt: new Date(),
    })
    .where(eq(s.entityThresholds.id, thresholdId));
  revalidatePath('/calendar/inverse');
  return { ok: true };
}

export async function muteStandstill(thresholdId: string): Promise<Result> {
  const auth = await authorizeThreshold(thresholdId);
  if (!auth.ok) return auth;
  const db = getDb();
  await db
    .update(s.entityThresholds)
    .set({
      isMuted: true,
      isInStandstill: false,
      standstillSince: null,
      updatedAt: new Date(),
    })
    .where(eq(s.entityThresholds.id, thresholdId));
  revalidatePath('/calendar/inverse');
  return { ok: true };
}

export async function unmuteStandstill(thresholdId: string): Promise<Result> {
  const auth = await authorizeThreshold(thresholdId);
  if (!auth.ok) return auth;
  const db = getDb();
  await db
    .update(s.entityThresholds)
    .set({ isMuted: false, mutedUntil: null, updatedAt: new Date() })
    .where(eq(s.entityThresholds.id, thresholdId));
  revalidatePath('/calendar/inverse');
  return { ok: true };
}

export async function acknowledgeStandstill(
  thresholdId: string
): Promise<Result> {
  const auth = await authorizeThreshold(thresholdId);
  if (!auth.ok) return auth;
  const db = getDb();
  await db
    .update(s.entityThresholds)
    .set({ lastAcknowledgedAt: new Date(), updatedAt: new Date() })
    .where(eq(s.entityThresholds.id, thresholdId));
  revalidatePath('/calendar/inverse');
  return { ok: true };
}
