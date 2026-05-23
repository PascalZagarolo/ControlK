import { redirect } from 'next/navigation';
import { listNotifications } from '@/lib/db/queries/notifications';
import { currentUser } from '@/lib/auth/current-user';
import { InboxClient } from '@/components/inbox/inbox-client';

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/inbox');
  const notifications = await listNotifications(user.id);
  return <InboxClient initial={notifications} />;
}
