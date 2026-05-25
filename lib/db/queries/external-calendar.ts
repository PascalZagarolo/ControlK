import 'server-only';
import { and, eq, gte, lt, ne } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';
import type { ExternalCalendarAttendee } from '../schema';
import type { ExternalEventStatus } from '@/lib/actions/event-metadata';

export type ExternalEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string;
  isAllDay: boolean;
  timezone: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  recurrenceRule: string | null;
  googleRecurringEventId: string | null;
  googleEventId: string;
  googleCalendarId: string;
  organizerEmail: string | null;
  organizerName: string | null;
  attendees: ExternalCalendarAttendee[];
  // Per-user Ctrl K metadata, eagerly LEFT-JOIN'd onto the range
  // query so the week grid can render status dots without a second
  // round-trip. Full metadata (notes, recap, tags) lazy-loads on
  // popover open via loadEventDetail.
  userStatus: ExternalEventStatus;
  hasUserNote: boolean;
};

/**
 * All events for a user that overlap the given range. An event
 * "overlaps" if its [start, end) intersects [rangeStart, rangeEnd):
 *   start < rangeEnd  AND  end > rangeStart.
 * Cancelled events are dropped at the query layer — they shouldn't
 * show in views even though we keep the row around for Phase 2
 * outbound-sync logic.
 */
export async function listExternalEventsInRange(
  userId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<ExternalEvent[]> {
  const db = getDb();
  // LEFT JOIN the per-user metadata row so the grid can show
  // status dots + note-indicators without N+1. Joining on
  // user_id keeps another user's metadata invisible if they
  // ever share an event (multi-attendee case).
  const rows = await db
    .select({
      id: s.externalCalendarEvents.id,
      title: s.externalCalendarEvents.title,
      description: s.externalCalendarEvents.description,
      location: s.externalCalendarEvents.location,
      startAt: s.externalCalendarEvents.startAt,
      endAt: s.externalCalendarEvents.endAt,
      isAllDay: s.externalCalendarEvents.isAllDay,
      timezone: s.externalCalendarEvents.timezone,
      status: s.externalCalendarEvents.status,
      recurrenceRule: s.externalCalendarEvents.recurrenceRule,
      googleRecurringEventId: s.externalCalendarEvents.googleRecurringEventId,
      googleEventId: s.externalCalendarEvents.googleEventId,
      googleCalendarId: s.externalCalendarEvents.googleCalendarId,
      organizerEmail: s.externalCalendarEvents.organizerEmail,
      organizerName: s.externalCalendarEvents.organizerName,
      attendees: s.externalCalendarEvents.attendees,
      userStatus: s.externalEventMetadata.status,
      noteMarkdown: s.externalEventMetadata.noteMarkdown,
    })
    .from(s.externalCalendarEvents)
    .leftJoin(
      s.externalEventMetadata,
      and(
        eq(s.externalEventMetadata.calendarEventId, s.externalCalendarEvents.id),
        eq(s.externalEventMetadata.userId, userId)
      )
    )
    .where(
      and(
        eq(s.externalCalendarEvents.userId, userId),
        ne(s.externalCalendarEvents.status, 'cancelled'),
        lt(s.externalCalendarEvents.startAt, rangeEnd),
        gte(s.externalCalendarEvents.endAt, rangeStart)
      )
    );

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    location: r.location,
    startAt: r.startAt.toISOString(),
    endAt: r.endAt.toISOString(),
    isAllDay: r.isAllDay,
    timezone: r.timezone,
    status: r.status as 'confirmed' | 'tentative' | 'cancelled',
    recurrenceRule: r.recurrenceRule,
    googleRecurringEventId: r.googleRecurringEventId,
    googleEventId: r.googleEventId,
    googleCalendarId: r.googleCalendarId,
    organizerEmail: r.organizerEmail,
    organizerName: r.organizerName,
    attendees: r.attendees,
    userStatus: (r.userStatus as ExternalEventStatus) ?? null,
    hasUserNote: !!r.noteMarkdown && r.noteMarkdown.trim().length > 0,
  }));
}

/**
 * User preferences with sensible defaults so the calendar renders even
 * when the row doesn't exist yet.
 */
export type CalendarPrefs = {
  weekStartsOn: 0 | 1;
  showWeekends: boolean;
  workingHoursStart: string; // "09:00"
  workingHoursEnd: string; // "18:00"
  defaultView: string;
};

export async function getCalendarPrefs(userId: string): Promise<CalendarPrefs> {
  const db = getDb();
  const row = await db.query.userCalendarPreferences.findFirst({
    where: eq(s.userCalendarPreferences.userId, userId),
  });
  if (!row) {
    return {
      weekStartsOn: 1,
      showWeekends: true,
      workingHoursStart: '09:00',
      workingHoursEnd: '18:00',
      defaultView: 'week',
    };
  }
  return {
    weekStartsOn: (row.weekStartsOn === 0 ? 0 : 1) as 0 | 1,
    showWeekends: row.showWeekends,
    workingHoursStart: row.workingHoursStart,
    workingHoursEnd: row.workingHoursEnd,
    defaultView: row.defaultView,
  };
}
