import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import {
  listChannels,
  listChannelSnippets,
  smartChannelCounts,
} from '@/lib/db/queries/channels';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { ChannelsListClient } from '@/components/channels/channels-list-client';

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/channels');
  const ws = await requireCurrentWorkspace();

  const [channels, snippets, counts, memberRows] = await Promise.all([
    listChannels(ws.id),
    listChannelSnippets(ws.id),
    smartChannelCounts(ws.id, user.id),
    (async () => {
      const db = getDb();
      return db.query.channelMembers.findMany({
        where: eq(s.channelMembers.userId, user.id),
        columns: { channelId: true },
      });
    })(),
  ]);

  const myChannelIds = memberRows.map((m) => m.channelId);

  return (
    <ChannelsListClient
      channels={channels}
      unreadByChannel={counts.unreadByChannel}
      myChannelIds={myChannelIds}
      snippets={snippets}
    />
  );
}
