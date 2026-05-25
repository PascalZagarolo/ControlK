import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { listChannels, smartChannelCounts } from '@/lib/db/queries/channels';
import {
  ChannelsSidebar,
  type SidebarChannel,
} from '@/components/channels/channels-sidebar';

/**
 * Channels module layout — wraps every /channels/* route in the
 * two-column Slack-style shell.
 *
 * The sidebar persists across channel switches; only the right column
 * (children) re-renders. The /channels page itself just redirects to a
 * default channel, so this layout is the visible UI surface for the
 * whole module.
 *
 * Personal workspaces don't have channels — we still mount the layout
 * but redirect to the foyer (defensive against direct URL access; the
 * top-nav already hides the tab).
 */
export default async function ChannelsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/channels');
  const ws = await requireCurrentWorkspace();
  if (ws.scope === 'private') redirect('/');

  const [channels, counts] = await Promise.all([
    listChannels(ws.id),
    smartChannelCounts(ws.id, user.id),
  ]);

  const sidebarChannels: SidebarChannel[] = channels.map((c) => ({
    id: c.id ?? c.slug,
    slug: c.slug,
    name: c.name,
    topic: c.topic || undefined,
    unread: counts.unreadByChannel[c.id ?? ''] ?? 0,
    // mentionCount stays 0 for V1 — channel-level mention tracking is
    // a follow-up; the per-user `notifications` rows give us the badge
    // on the foyer-stack which is the more important signal right now.
    mentionCount: 0,
    archived: c.archived,
  }));

  return (
    <div className="flex min-h-screen pt-[64px]">
      <ChannelsSidebar channels={sidebarChannels} />
      <div className="flex-1 overflow-x-hidden">{children}</div>
    </div>
  );
}
