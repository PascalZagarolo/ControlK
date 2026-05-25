import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import {
  countActivity,
  listStandstills,
} from '@/lib/db/queries/inverse-calendar';
import { InverseView } from '@/components/calendar/inverse-view';

export default async function InverseCalendarPage() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/calendar/inverse');

  const [standstills, activity] = await Promise.all([
    listStandstills(user.id),
    countActivity(user.id),
  ]);

  return (
    <InverseView
      standstills={standstills}
      hasActivity={activity > 0}
    />
  );
}
