import 'server-only';

import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { getValidGoogleAccessToken } from '@/lib/auth/google-tokens';
import { appUrl } from '@/lib/email/send';
import type { ExternalCalendarAttendee } from '@/lib/db/schema';
import { ingestCalendarEventActivity } from '@/lib/inverse/ingest';

// Scope constants live in a separate module so client components can
// reference them without dragging this server-only file along. Re-
// export here so existing import sites keep working.
export { GOOGLE_CALENDAR_SCOPES, hasCalendarScope } from './calendar-scopes';

// ─── HTTP ───────────────────────────────────────────────────────
class CalendarAuthError extends Error {
  constructor(public status: number) {
    super(`Google Calendar unauthorized (${status})`);
    this.name = 'CalendarAuthError';
  }
}

const API = 'https://www.googleapis.com/calendar/v3';

async function cfetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
  if (res.status === 401 || res.status === 403) {
    throw new CalendarAuthError(res.status);
  }
  if (res.status === 410) {
    // Sync-token gone — caller decides to do a full resync.
    const err = new Error('SYNC_TOKEN_GONE') as Error & { status: number };
    err.status = 410;
    throw err;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Calendar API ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

// ─── Types ──────────────────────────────────────────────────────
type GoogleEventTime =
  | { date: string; timeZone?: string }
  | { dateTime: string; timeZone?: string };

type GoogleEvent = {
  id: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  htmlLink?: string;
  summary?: string;
  description?: string;
  location?: string;
  start: GoogleEventTime;
  end: GoogleEventTime;
  recurringEventId?: string;
  recurrence?: string[];
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
    organizer?: boolean;
  }>;
  organizer?: { email?: string; displayName?: string };
  etag?: string;
  updated: string;
};

type EventListResponse = {
  items: GoogleEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
};

export type GoogleCalendarListEntry = {
  id: string;
  summary: string;
  primary?: boolean;
  accessRole: string;
  timeZone?: string;
};

type CalendarListResponse = { items: GoogleCalendarListEntry[] };

type WatchResponse = {
  id: string;
  resourceId: string;
  expiration?: string;
};

// ─── Calendar list ──────────────────────────────────────────────
export async function listUserCalendars(
  userId: string
): Promise<GoogleCalendarListEntry[]> {
  const token = await getValidGoogleAccessToken(userId);
  if (!token) throw new CalendarAuthError(401);
  const data = await cfetch<CalendarListResponse>(
    '/users/me/calendarList',
    token
  );
  return data.items.filter((c) => c.primary || c.accessRole !== 'reader');
}

// ─── Upsert helper ──────────────────────────────────────────────
function parseEventTime(t: GoogleEventTime): { date: Date; allDay: boolean } {
  if ('dateTime' in t) {
    return { date: new Date(t.dateTime), allDay: false };
  }
  // All-day events use the `date` form. Treat as midnight UTC; the
  // explicit timezone is preserved in the row's `timezone` column.
  return { date: new Date(t.date + 'T00:00:00Z'), allDay: true };
}

async function upsertEvent(
  userId: string,
  workspaceId: string | null,
  calendarId: string,
  ev: GoogleEvent
): Promise<void> {
  const db = getDb();
  const attendees: ExternalCalendarAttendee[] = (ev.attendees ?? []).map((a) => ({
    email: a.email,
    name: a.displayName,
    responseStatus: a.responseStatus,
    isOrganizer: !!a.organizer,
  }));
  const start = parseEventTime(ev.start);
  const end = parseEventTime(ev.end);
  const tz =
    ('timeZone' in ev.start && ev.start.timeZone) ||
    ('timeZone' in ev.end && ev.end.timeZone) ||
    'Europe/Berlin';

  const values = {
    userId,
    workspaceId,
    googleCalendarId: calendarId,
    googleEventId: ev.id,
    googleRecurringEventId: ev.recurringEventId,
    title: ev.summary?.trim() || '(Kein Titel)',
    description: ev.description ?? null,
    location: ev.location ?? null,
    startAt: start.date,
    endAt: end.date,
    isAllDay: start.allDay,
    timezone: tz,
    attendees,
    organizerEmail: ev.organizer?.email ?? null,
    organizerName: ev.organizer?.displayName ?? null,
    recurrenceRule: ev.recurrence?.[0] ?? null,
    status: ev.status,
    googleEtag: ev.etag ?? null,
    googleUpdatedAt: new Date(ev.updated),
    lastSyncedAt: new Date(),
  };

  await db
    .insert(s.externalCalendarEvents)
    .values(values)
    .onConflictDoUpdate({
      target: [
        s.externalCalendarEvents.userId,
        s.externalCalendarEvents.googleCalendarId,
        s.externalCalendarEvents.googleEventId,
      ],
      set: {
        workspaceId: values.workspaceId,
        googleRecurringEventId: values.googleRecurringEventId,
        title: values.title,
        description: values.description,
        location: values.location,
        startAt: values.startAt,
        endAt: values.endAt,
        isAllDay: values.isAllDay,
        timezone: values.timezone,
        attendees: values.attendees,
        organizerEmail: values.organizerEmail,
        organizerName: values.organizerName,
        recurrenceRule: values.recurrenceRule,
        status: values.status,
        googleEtag: values.googleEtag,
        googleUpdatedAt: values.googleUpdatedAt,
        lastSyncedAt: values.lastSyncedAt,
      },
    });

  // Inverse Calendar — feed the activity_log so every attendee touch
  // counts toward the standstill engine. Fire-and-forget; failures
  // here must not block the upsert.
  void ingestCalendarEventActivity({
    userId,
    workspaceId,
    eventId: ev.id,
    startAt: start.date,
    attendees,
    organizerEmail: ev.organizer?.email ?? null,
  });
}

async function deleteEvent(
  userId: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const db = getDb();
  await db
    .delete(s.externalCalendarEvents)
    .where(
      and(
        eq(s.externalCalendarEvents.userId, userId),
        eq(s.externalCalendarEvents.googleCalendarId, calendarId),
        eq(s.externalCalendarEvents.googleEventId, eventId)
      )
    );
}

async function upsertSyncState(
  userId: string,
  calendarId: string,
  patch: {
    syncToken?: string | null;
    googleCalendarName?: string | null;
    webhookChannelId?: string | null;
    webhookResourceId?: string | null;
    webhookExpiresAt?: Date | null;
    lastSyncedAt?: Date;
  }
) {
  const db = getDb();
  const existing = await db.query.calendarSyncState.findFirst({
    where: and(
      eq(s.calendarSyncState.userId, userId),
      eq(s.calendarSyncState.googleCalendarId, calendarId)
    ),
  });
  if (existing) {
    await db
      .update(s.calendarSyncState)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(s.calendarSyncState.id, existing.id));
  } else {
    await db.insert(s.calendarSyncState).values({
      userId,
      googleCalendarId: calendarId,
      ...patch,
    });
  }
}

// ─── Initial full sync ──────────────────────────────────────────
// 30 days back, 180 forward — enough to populate the agenda view
// without burning quota on archived calendars. Re-runs are cheap
// (incremental sync via syncToken).
const INITIAL_RANGE_BACK_DAYS = 30;
const INITIAL_RANGE_FORWARD_DAYS = 180;

export async function initialSyncCalendar(
  userId: string,
  calendarId: string,
  workspaceId: string | null
): Promise<{ events: number }> {
  const token = await getValidGoogleAccessToken(userId);
  if (!token) throw new CalendarAuthError(401);

  const timeMin = new Date(
    Date.now() - INITIAL_RANGE_BACK_DAYS * 86_400_000
  ).toISOString();
  const timeMax = new Date(
    Date.now() + INITIAL_RANGE_FORWARD_DAYS * 86_400_000
  ).toISOString();

  let pageToken: string | undefined;
  let count = 0;

  do {
    const url = new URL(
      `${API}/calendars/${encodeURIComponent(calendarId)}/events`
    );
    url.searchParams.set('timeMin', timeMin);
    url.searchParams.set('timeMax', timeMax);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('maxResults', '250');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const path = url.toString().replace(API, '');
    const data = await cfetch<EventListResponse>(path, token);

    for (const ev of data.items) {
      if (ev.status === 'cancelled') {
        await deleteEvent(userId, calendarId, ev.id);
      } else {
        await upsertEvent(userId, workspaceId, calendarId, ev);
        count += 1;
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  // Capture a syncToken for future incremental syncs. The first
  // events.list call with timeMin/timeMax can't emit one; a fresh
  // call without time bounds does. We ask for maxResults=1 to keep it
  // cheap — we only care about nextSyncToken, not the page.
  let syncToken: string | undefined;
  let cursor: string | undefined;
  do {
    const u = new URL(`${API}/calendars/${encodeURIComponent(calendarId)}/events`);
    u.searchParams.set('maxResults', '250');
    u.searchParams.set('singleEvents', 'true');
    if (cursor) u.searchParams.set('pageToken', cursor);
    const path = u.toString().replace(API, '');
    const data = await cfetch<EventListResponse>(path, token);
    cursor = data.nextPageToken;
    if (!cursor) syncToken = data.nextSyncToken;
  } while (cursor);

  await upsertSyncState(userId, calendarId, {
    syncToken: syncToken ?? null,
    lastSyncedAt: new Date(),
  });

  return { events: count };
}

// ─── Incremental sync via syncToken ─────────────────────────────
export async function incrementalSyncCalendar(
  userId: string,
  calendarId: string,
  workspaceId: string | null
): Promise<{ added: number; removed: number; fellBackToFull: boolean }> {
  const db = getDb();
  const state = await db.query.calendarSyncState.findFirst({
    where: and(
      eq(s.calendarSyncState.userId, userId),
      eq(s.calendarSyncState.googleCalendarId, calendarId)
    ),
  });

  if (!state?.syncToken) {
    const r = await initialSyncCalendar(userId, calendarId, workspaceId);
    return { added: r.events, removed: 0, fellBackToFull: true };
  }

  const token = await getValidGoogleAccessToken(userId);
  if (!token) throw new CalendarAuthError(401);

  let pageToken: string | undefined;
  let newSyncToken: string | undefined;
  let added = 0;
  let removed = 0;

  try {
    do {
      const url = new URL(
        `${API}/calendars/${encodeURIComponent(calendarId)}/events`
      );
      url.searchParams.set('syncToken', state.syncToken);
      url.searchParams.set('singleEvents', 'true');
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const path = url.toString().replace(API, '');
      const data = await cfetch<EventListResponse>(path, token);

      for (const ev of data.items) {
        if (ev.status === 'cancelled') {
          await deleteEvent(userId, calendarId, ev.id);
          removed += 1;
        } else {
          await upsertEvent(userId, workspaceId, calendarId, ev);
          added += 1;
        }
      }

      pageToken = data.nextPageToken;
      if (!pageToken && data.nextSyncToken) newSyncToken = data.nextSyncToken;
    } while (pageToken);
  } catch (e: any) {
    if (e?.status === 410) {
      // Token expired (Google rotates them after ~30 days of inactivity
      // or schema changes). Wipe and recurse to full resync.
      await upsertSyncState(userId, calendarId, { syncToken: null });
      const r = await initialSyncCalendar(userId, calendarId, workspaceId);
      return { added: r.events, removed: 0, fellBackToFull: true };
    }
    throw e;
  }

  if (newSyncToken) {
    await upsertSyncState(userId, calendarId, {
      syncToken: newSyncToken,
      lastSyncedAt: new Date(),
    });
  } else {
    await upsertSyncState(userId, calendarId, { lastSyncedAt: new Date() });
  }

  return { added, removed, fellBackToFull: false };
}

// ─── Push notifications (watch) ─────────────────────────────────
// Webhook delivery URL must be publicly reachable HTTPS. In local dev
// Google can't hit localhost — use ngrok/cloudflared or rely on the
// manual sync endpoint as fallback.
const WATCH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function setupCalendarWatch(
  userId: string,
  calendarId: string
): Promise<{ channelId: string; resourceId: string; expiresAt: Date } | null> {
  const token = await getValidGoogleAccessToken(userId);
  if (!token) throw new CalendarAuthError(401);

  const channelId = `cal-${userId}-${randomUUID()}`;
  const webhookUrl = `${appUrl()}/api/webhooks/google-calendar`;
  if (!webhookUrl.startsWith('https://')) {
    // Google rejects non-https URLs. In dev this is expected — caller
    // skips watch setup and relies on the manual/cron sync paths.
    return null;
  }

  const data = await cfetch<WatchResponse>(
    `/calendars/${encodeURIComponent(calendarId)}/events/watch`,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
        // Identifies user + calendar back to us in the webhook
        // headers. Google echoes this as x-goog-channel-token.
        token: `${userId}:${calendarId}`,
        expiration: Date.now() + WATCH_TTL_MS,
      }),
    }
  );

  const expiresAt = data.expiration
    ? new Date(parseInt(data.expiration, 10))
    : new Date(Date.now() + WATCH_TTL_MS);

  await upsertSyncState(userId, calendarId, {
    webhookChannelId: data.id,
    webhookResourceId: data.resourceId,
    webhookExpiresAt: expiresAt,
  });

  return { channelId: data.id, resourceId: data.resourceId, expiresAt };
}

export async function stopCalendarWatch(
  userId: string,
  channelId: string,
  resourceId: string
): Promise<void> {
  const token = await getValidGoogleAccessToken(userId);
  if (!token) return; // best-effort: if we can't auth, the watch will die naturally
  try {
    await cfetch('/channels/stop', token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: channelId, resourceId }),
    });
  } catch (e) {
    // Already gone or auth lost — both fine, watch is harmless.
    console.warn('[calendar/stopWatch] best-effort fail:', e);
  }
}
