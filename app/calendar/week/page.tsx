import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { endOfWeek as endOfWeekFn, startOfWeek } from '@/lib/calendar-time';
import {
  getCalendarPrefs,
  listExternalEventsInRange,
} from '@/lib/db/queries/external-calendar';
import { ExternalWeekView } from '@/components/calendar/external-week-view';

export default async function CalendarWeekIndex() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/calendar/week');

  const prefs = await getCalendarPrefs(user.id);
  const today = new Date();
  const weekStart = startOfWeek(today, prefs.weekStartsOn);
  const weekEnd = endOfWeekFn(today, prefs.weekStartsOn);

  const events = await listExternalEventsInRange(user.id, weekStart, weekEnd);

  return (
    <ExternalWeekView
      weekStartISO={weekStart.toISOString()}
      events={events}
      prefs={prefs}
      todayISO={today.toISOString()}
    />
  );
}
