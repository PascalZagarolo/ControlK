import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { incrementalSyncCalendar } from '@/lib/google/calendar';

export const dynamic = 'force-dynamic';

/**
 * Google Calendar push-notification handler.
 *
 * Google fires this URL whenever an event in a watched calendar
 * changes. We don't get the diff in the request body — Google sends
 * a heads-up and we pull via incrementalSyncCalendar.
 *
 * Auth: we validate the channel-token header (set when the watch was
 * created in lib/google/calendar.ts → setupCalendarWatch). It encodes
 * `${userId}:${calendarId}` so we know who to sync for. We also
 * cross-check that the resource_id matches what we stored, so an
 * attacker who guesses the token still can't poke arbitrary calendars.
 */
export async function POST(req: NextRequest) {
  const resourceState = req.headers.get('x-goog-resource-state');
  const channelId = req.headers.get('x-goog-channel-id');
  const channelToken = req.headers.get('x-goog-channel-token');
  const resourceId = req.headers.get('x-goog-resource-id');

  // Google's initial subscription handshake fires with state=sync; the
  // resource doesn't exist yet, so just ack and move on.
  if (resourceState === 'sync') {
    return new NextResponse('OK');
  }
  // Other lifecycle states (e.g. 'not_exists', 'channel terminated')
  // are informational — ack and skip.
  if (resourceState !== 'exists') {
    return new NextResponse('OK');
  }
  if (!channelId || !channelToken || !resourceId) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  const [userId, calendarId] = channelToken.split(':');
  if (!userId || !calendarId) {
    return new NextResponse('Bad Token', { status: 400 });
  }

  // Verify the channel matches what we stored. Prevents spoofed
  // webhooks from triggering syncs against accounts they don't own.
  const db = getDb();
  const state = await db.query.calendarSyncState.findFirst({
    where: and(
      eq(s.calendarSyncState.userId, userId),
      eq(s.calendarSyncState.googleCalendarId, calendarId),
      eq(s.calendarSyncState.webhookChannelId, channelId)
    ),
  });
  if (!state || state.webhookResourceId !== resourceId) {
    return new NextResponse('Channel Not Found', { status: 404 });
  }

  // Pick the user's first workspace as the context for newly synced
  // events. Matches the inbox-cron pattern; multi-workspace users can
  // later get a per-workspace selector.
  const ws = await db.query.workspaceMembers.findFirst({
    where: eq(s.workspaceMembers.userId, userId),
    columns: { workspaceId: true },
  });

  // Fire-and-forget. Google retries on non-2xx, but we want to ack
  // promptly so it stops re-firing the same event. Errors get logged
  // and the cron/manual-sync fallbacks will catch any missed change.
  void incrementalSyncCalendar(userId, calendarId, ws?.workspaceId ?? null).catch(
    (e) =>
      console.error(
        `[webhook/google-calendar] user=${userId} sync failed:`,
        e instanceof Error ? e.message : e
      )
  );

  return new NextResponse('OK');
}
