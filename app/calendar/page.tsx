import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { getCalendarPrefs } from '@/lib/db/queries/external-calendar';

export default async function CalendarIndex() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/calendar');
  const prefs = await getCalendarPrefs(user.id);
  const view =
    prefs.defaultView === 'day' ||
    prefs.defaultView === 'month' ||
    prefs.defaultView === 'agenda' ||
    prefs.defaultView === 'inverse'
      ? prefs.defaultView
      : 'week';
  redirect(`/calendar/${view}`);
}
