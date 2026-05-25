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
import { getCurrentWorkspace, listUserWorkspaces } from '@/lib/db/current-workspace';
import { buildFoyerData } from '@/lib/foyer/build-foyer-data';
import {
  FoyerClient,
  type FoyerData,
  type FoyerWorkspace,
} from '@/components/foyer/foyer-client';

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

function toFoyerWorkspace(w: {
  id: string;
  slug: string;
  name: string;
  short: string;
  fromColor: string;
  toColor: string;
  scope: string;
}): FoyerWorkspace {
  return {
    id: w.id,
    slug: w.slug,
    name: w.name,
    short: w.short,
    from: w.fromColor,
    to: w.toColor,
    scope: (w.scope === 'private' ? 'private' : 'business') as 'business' | 'private',
  };
}

export default async function Page() {
  const user = await currentUser();
  if (!user) {
    return <FoyerClient {...ANONYMOUS_FOYER} />;
  }
  const ws = await getCurrentWorkspace();
  if (!ws) {
    return <FoyerClient {...ANONYMOUS_FOYER} userName={user.name.split(' ')[0]} />;
  }

  // Workspaces feed the inline foyer-switcher dropdown. Parallel to
  // the foyer-data fetch so we don't add a serial hop.
  const workspaceScope = (ws.scope === 'private' ? 'private' : 'business') as
    | 'business'
    | 'private';
  const [data, workspaces] = await Promise.all([
    buildFoyerData({
      workspaceId: ws.id,
      userId: user.id,
      userName: user.name.split(' ')[0] || user.name,
      workspaceScope,
      workspaceName: ws.name,
    }),
    listUserWorkspaces(),
  ]);

  return (
    <FoyerClient
      {...data}
      activeWorkspace={toFoyerWorkspace(ws)}
      workspaces={workspaces.map(toFoyerWorkspace)}
    />
  );
}
