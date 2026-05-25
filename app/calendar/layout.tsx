import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { currentUser } from '@/lib/auth/current-user';
import { CalendarSubheader } from '@/components/calendar/calendar-subheader';

export default async function CalendarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/calendar');

  const h = await headers();
  const pathname = h.get('x-pathname') ?? '';

  return (
    <div className="flex h-screen flex-col pt-[64px]">
      <CalendarSubheader pathname={pathname} />
      <div className="min-h-0 flex-1 overflow-hidden bg-ink-900">{children}</div>
    </div>
  );
}
