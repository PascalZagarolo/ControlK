import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import {
  detectEntityHits,
  getChannelFullBySlug,
  getChannelIdBySlug,
  getCustomerContactEmails,
  listChannels,
  listChannelMessages,
  listChannelSnippets,
} from '@/lib/db/queries/channels';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';
import { ChannelDetailClient } from '@/components/channel/channel-detail-client';
import type { ChannelEntityHit } from '@/lib/types';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await currentUser();
  if (!user) redirect(`/sign-in?from=/channels/${slug}`);
  const ws = await requireCurrentWorkspace();

  const channel = await getChannelFullBySlug(ws.id, slug);
  if (!channel) notFound();
  const channelId = await getChannelIdBySlug(ws.id, slug);

  const [messages, allChannels, snippets, customerEmails] = await Promise.all([
    channelId ? listChannelMessages(channelId) : Promise.resolve([]),
    listChannels(ws.id),
    listChannelSnippets(ws.id),
    getCustomerContactEmails(ws.id),
  ]);

  // Resolve message author emails for customer-contact highlight
  const authorIds = Array.from(new Set(messages.map((m: any) => m.authorId).filter(Boolean)));
  const db = getDb();
  const authorEmailMap = new Map<string, string>();
  if (authorIds.length > 0) {
    const users = await db.query.users.findMany({
      where: inArray(s.users.id, authorIds),
      columns: { id: true, email: true },
    });
    for (const u of users) authorEmailMap.set(u.id, u.email);
  }

  // Attach authorEmail onto each message for client-side contact-match
  const messagesWithEmail = messages.map((m: any) => ({
    ...m,
    authorEmail: authorEmailMap.get((m as any).authorId) ?? undefined,
  }));

  // Detect entity-hits per message (limit to last 50 for perf)
  const recent = messagesWithEmail.slice(-50);
  const entityHitsByMsg: Record<string, ChannelEntityHit[]> = {};
  for (const m of recent) {
    const hits = await detectEntityHits(ws.id, m.body);
    if (hits.length > 0) entityHitsByMsg[m.id] = hits;
  }

  const customerContactEmails: Record<string, { customerId: string; customerName: string }> = {};
  for (const [email, v] of customerEmails) customerContactEmails[email] = v;

  return (
    <ChannelDetailClient
      channel={channel}
      channelId={channelId}
      messages={messagesWithEmail}
      channels={allChannels.map((c) => ({ slug: c.slug, name: c.name, unread: c.unread }))}
      entityHitsByMsg={entityHitsByMsg}
      customerContactEmails={customerContactEmails}
      snippets={snippets}
      currentUserId={user.id}
      currentUserName={user.name}
    />
  );
}
