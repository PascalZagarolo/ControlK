import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import {
  getAwaitingSplit,
  getInboxCounts,
  groupInboxBySender,
  listInboxItemsPaginated,
  type InboxCategoryKey,
  type InboxFilter,
} from '@/lib/db/queries/inbox-overview';
import { fetchGmailConnectionState } from '@/lib/foyer/gmail-state';
import { listOpenCommitments } from '@/lib/db/queries/commitments';
import { getChurnAlerts } from '@/lib/db/queries/churn';
import { InboxOverviewClient } from './inbox-overview-client';

export const dynamic = 'force-dynamic';

type Search = {
  filter?: string;
  mode?: string;
  p?: string;
  category?: string;
  topic?: string;
  range?: string;
};

function parseRange(raw: string | undefined): 'today' | 'week' | null {
  return raw === 'today' || raw === 'week' ? raw : null;
}

const CATEGORY_KEYS = new Set<InboxCategoryKey>([
  'primary',
  'customer',
  'shipping',
  'promo',
  'social',
  'updates',
  'forums',
]);

function parseCategory(raw: string | undefined): InboxCategoryKey | null {
  if (!raw) return null;
  return CATEGORY_KEYS.has(raw as InboxCategoryKey)
    ? (raw as InboxCategoryKey)
    : null;
}

function parseTopic(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed && trimmed.length <= 64 ? trimmed : null;
}

function parseFilter(raw: string | undefined): InboxFilter {
  if (raw === 'all' || raw === 'unread' || raw === 'archived') return raw;
  return 'unread';
}

function parseMode(raw: string | undefined): 'list' | 'group' | 'awaiting' {
  if (raw === 'group') return 'group';
  if (raw === 'awaiting') return 'awaiting';
  return 'list';
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
  const category = parseCategory(sp.category);
  const topic = parseTopic(sp.topic);
  const range = parseRange(sp.range);

  // Force list mode when filtering by topic (the group/awaiting modes
  // ignore topic for V1 — adding the JOIN to them is the next iteration).
  const effectiveMode = topic ? 'list' : mode;

  const [pageData, groups, cockpit, gmail, counts] = await Promise.all([
    effectiveMode === 'list'
      ? listInboxItemsPaginated(ws.id, user.id, { filter, page, category, topic, range })
      : Promise.resolve(null),
    effectiveMode === 'group'
      ? groupInboxBySender(ws.id, user.id, {
          filter: filter === 'unread' ? 'unread' : 'all',
        })
      : Promise.resolve(null),
    // Always load the awaiting split — powers both the "awaiting" mode and
    // the morning cockpit on the default view.
    getAwaitingSplit(ws.id, user.id).catch(() => null),
    fetchGmailConnectionState(user.id).catch(() => ({
      connected: false,
      syncedAt: null,
    })),
    getInboxCounts(ws.id, user.id).catch(() => null),
  ]);

  const [commitments, churnAlerts] = await Promise.all([
    listOpenCommitments(ws.id, user.id).catch(() => []),
    effectiveMode === 'list'
      ? getChurnAlerts(ws.id).catch(() => [])
      : Promise.resolve([]),
  ]);

  return (
    <InboxOverviewClient
      mode={effectiveMode}
      filter={filter}
      category={category}
      topic={topic}
      gmailConnected={gmail.connected}
      pageData={pageData}
      groups={groups}
      awaiting={effectiveMode === 'awaiting' ? cockpit : null}
      counts={counts}
      cockpit={cockpit}
      customerCount={counts?.byCategory.customer ?? 0}
      range={range}
      commitments={commitments}
      churnAlerts={churnAlerts}
    />
  );
}
