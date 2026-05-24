import { redirect } from 'next/navigation';
import { listNotifications } from '@/lib/db/queries/notifications';
import { currentUser } from '@/lib/auth/current-user';
import { InboxClient } from '@/components/inbox/inbox-client';

// Internal notifications (mentions, channel pings, deal updates, system).
// This used to live at /inbox; /inbox now hosts the email overview so
// the URL matches the user's mental model of "Inbox = email". Internal
// pings get their own page here, reached via the bell.

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/notifications');
  const notifications = await listNotifications(user.id);
  return <InboxClient initial={notifications} />;
}
