import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { computeThresholdsForUser } from '@/lib/inverse/engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Daily cron — for every user with any activity_log entries, recompute
 * their entity_thresholds (medians, IQRs, importance scores). Cheap
 * per user; bounded by the SELECT DISTINCT in the engine.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
  }

  const db = getDb();
  // Distinct users that have at least one activity_log row.
  const userIds = await db
    .selectDistinct({ userId: s.activityLog.userId })
    .from(s.activityLog);

  let synced = 0;
  let failed = 0;
  for (const u of userIds) {
    try {
      await computeThresholdsForUser(u.userId);
      synced += 1;
    } catch (e) {
      failed += 1;
      console.error(
        `[cron/compute-thresholds] user=${u.userId} failed:`,
        e instanceof Error ? e.message : e
      );
    }
  }
  return NextResponse.json({ ok: true, users: userIds.length, synced, failed });
}
