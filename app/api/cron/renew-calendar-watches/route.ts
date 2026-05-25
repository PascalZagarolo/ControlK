import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, isNotNull, lt } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { setupCalendarWatch, stopCalendarWatch } from '@/lib/google/calendar';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const RENEW_BEFORE_MS = 24 * 60 * 60 * 1000; // renew within 24h of expiry

/**
 * Cron: refresh Google Calendar push-notification watches before they
 * expire (~7d TTL on the Google side). Without renewal the webhook
 * goes silent and we fall back to manual/cron polling.
 *
 * Schedule (vercel.json): every 6 hours. With 24h renewal lead-time
 * and one missed run we still have ~18h buffer.
 *
 * Auth: same pattern as sync-inboxes — Bearer CRON_SECRET when
 * configured, open for local manual triggers when not.
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
  const cutoff = new Date(Date.now() + RENEW_BEFORE_MS);

  const expiring = await db
    .select({
      id: s.calendarSyncState.id,
      userId: s.calendarSyncState.userId,
      googleCalendarId: s.calendarSyncState.googleCalendarId,
      webhookChannelId: s.calendarSyncState.webhookChannelId,
      webhookResourceId: s.calendarSyncState.webhookResourceId,
    })
    .from(s.calendarSyncState)
    .where(
      and(
        eq(s.calendarSyncState.isEnabled, true),
        isNotNull(s.calendarSyncState.webhookExpiresAt),
        lt(s.calendarSyncState.webhookExpiresAt, cutoff)
      )
    );

  let renewed = 0;
  let failed = 0;
  for (const row of expiring) {
    try {
      // Best-effort stop of the old watch — if it fails we still get
      // a fresh one; the old one ages out naturally.
      if (row.webhookChannelId && row.webhookResourceId) {
        await stopCalendarWatch(
          row.userId,
          row.webhookChannelId,
          row.webhookResourceId
        );
      }
      const result = await setupCalendarWatch(row.userId, row.googleCalendarId);
      if (result) renewed += 1;
      else failed += 1; // dev (non-https appUrl) returns null
    } catch (e) {
      failed += 1;
      console.error(
        `[cron/renew-calendar-watches] user=${row.userId} cal=${row.googleCalendarId} failed:`,
        e instanceof Error ? e.message : e
      );
    }
  }

  return NextResponse.json({ ok: true, candidates: expiring.length, renewed, failed });
}
