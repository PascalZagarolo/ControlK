/**
 * Foyer — workspace landing.
 *
 * Server component. Fetches all workspace data (today's events, unread
 * counts, latest message, todo counts, jetzt-suggestions) and hands it
 * to the FoyerClient component, which renders the UI and handles all
 * interactions (search focus, doorway transition, suggestion cycling).
 *
 * On auth failure or workspace miss → render a calm "demo" foyer with a
 * generic name and empty data. We deliberately don't redirect to /sign-in
 * here — the foyer tolerates anonymous viewers gracefully.
 */

import { currentUser } from '@/lib/auth/current-user';
import { getCurrentWorkspace } from '@/lib/db/current-workspace';
import { buildFoyerData } from '@/lib/foyer/build-foyer-data';
import { FoyerClient, type FoyerData } from '@/components/foyer/foyer-client';

export const dynamic = 'force-dynamic';

const ANONYMOUS_FOYER: FoyerData = {
  userName: 'Gast',
  events: [],
  unread: 0,
  email: 0,
  channels: 0,
  mentions: 0,
  latestMessage: null,
  dueToday: 0,
  dueWeek: 0,
  dueTomorrow: 0,
  jetztSuggestions: [],
};

export default async function Page() {
  const user = await currentUser();
  if (!user) {
    return <FoyerClient {...ANONYMOUS_FOYER} />;
  }
  const ws = await getCurrentWorkspace();
  if (!ws) {
    return <FoyerClient {...ANONYMOUS_FOYER} userName={user.name.split(' ')[0]} />;
  }

  const data = await buildFoyerData({
    workspaceId: ws.id,
    userId: user.id,
    userName: user.name.split(' ')[0] || user.name,
  });

  return <FoyerClient {...data} />;
}
