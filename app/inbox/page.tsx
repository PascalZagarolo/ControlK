import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import {
  groupInboxBySender,
  listInboxItemsPaginated,
  type InboxFilter,
} from '@/lib/db/queries/inbox-overview';
import { fetchGmailConnectionState } from '@/lib/foyer/gmail-state';
import { InboxOverviewClient } from './inbox-overview-client';

export const dynamic = 'force-dynamic';

type Search = {
  filter?: string;
  mode?: string;
  p?: string;
};

function parseFilter(raw: string | undefined): InboxFilter {
  if (raw === 'all' || raw === 'unread' || raw === 'archived') return raw;
  return 'unread';
}

function parseMode(raw: string | undefined): 'list' | 'group' {
  return raw === 'group' ? 'group' : 'list';
}

function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/inbox');
  const ws = await requireCurrentWorkspace();

  const sp = await searchParams;
  const filter = parseFilter(sp.filter);
  const mode = parseMode(sp.mode);
  const page = parsePage(sp.p);

  // Fetch the right shape for the active mode. We deliberately don't
  // load both — group-by-sender is heavier and the toggle re-navigates
  // the URL anyway.
  const [pageData, groups, gmail] = await Promise.all([
    mode === 'list'
      ? listInboxItemsPaginated(ws.id, { filter, page })
      : Promise.resolve(null),
    mode === 'group'
      ? groupInboxBySender(ws.id, {
          filter: filter === 'unread' ? 'unread' : 'all',
        })
      : Promise.resolve(null),
    fetchGmailConnectionState(user.id).catch(() => ({
      connected: false,
      syncedAt: null,
    })),
  ]);

  return (
    <InboxOverviewClient
      mode={mode}
      filter={filter}
      gmailConnected={gmail.connected}
      pageData={pageData}
      groups={groups}
    />
  );
}
