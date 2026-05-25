import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import {
  endOfWeek as endOfWeekFn,
  parseISOWeek,
  startOfWeek,
} from '@/lib/calendar-time';
import {
  getCalendarPrefs,
  listExternalEventsInRange,
} from '@/lib/db/queries/external-calendar';
import { ExternalWeekView } from '@/components/calendar/external-week-view';

export default async function CalendarWeekSpecific({
  params,
}: {
  params: Promise<{ isoweek: string }>;
}) {
  const { isoweek } = await params;
  const user = await currentUser();
  if (!user) redirect(`/sign-in?from=/calendar/week/${isoweek}`);

  const anchor = parseISOWeek(decodeURIComponent(isoweek));
  if (!anchor) notFound();

  const prefs = await getCalendarPrefs(user.id);
  const weekStart = startOfWeek(anchor, prefs.weekStartsOn);
  const weekEnd = endOfWeekFn(anchor, prefs.weekStartsOn);

  const events = await listExternalEventsInRange(user.id, weekStart, weekEnd);

  return (
    <ExternalWeekView
      weekStartISO={weekStart.toISOString()}
      events={events}
      prefs={prefs}
      todayISO={new Date().toISOString()}
    />
  );
}
