import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { detectStandstillsForUser } from '@/lib/inverse/engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Daily cron — runs after compute-thresholds. Walks every user with
 * entity_thresholds rows and flips is_in_standstill based on the
 * current days-silent vs. each entity's threshold.
 *
 * Idempotent: safe to re-run; no double-flagging because state
 * transitions are gated on previous state.
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
  const userIds = await db
    .selectDistinct({ userId: s.entityThresholds.userId })
    .from(s.entityThresholds);

  let entered = 0;
  let resolved = 0;
  let failed = 0;
  for (const u of userIds) {
    try {
      const r = await detectStandstillsForUser(u.userId);
      entered += r.entered;
      resolved += r.resolved;
    } catch (e) {
      failed += 1;
      console.error(
        `[cron/detect-standstills] user=${u.userId} failed:`,
        e instanceof Error ? e.message : e
      );
    }
  }
  return NextResponse.json({
    ok: true,
    users: userIds.length,
    entered,
    resolved,
    failed,
  });
}
