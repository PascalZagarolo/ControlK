import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import {
  detectEntityHits,
  getChannelFullBySlug,
  getChannelIdBySlug,
  getCustomerContactEmails,
  listChannelMembersDetailed,
  listChannelMessages,
} from '@/lib/db/queries/channels';
import { getMyRole } from '@/lib/db/queries/workspace';
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

  const [messages, customerEmails, members, myRole] = await Promise.all([
    channelId ? listChannelMessages(channelId) : Promise.resolve([]),
    getCustomerContactEmails(ws.id),
    channelId ? listChannelMembersDetailed(ws.id, channelId) : Promise.resolve([]),
    getMyRole(ws.id, user.id),
  ]);

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

  const messagesWithEmail = messages.map((m: any) => ({
    ...m,
    authorEmail: authorEmailMap.get((m as any).authorId) ?? undefined,
  }));

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
      members={members}
      currentUserId={user.id}
      isOwner={myRole === 'owner'}
      entityHitsByMsg={entityHitsByMsg}
      customerContactEmails={customerContactEmails}
    />
  );
}
