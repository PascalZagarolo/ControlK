'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomBytes } from 'crypto';
import { and, eq, max } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { triggerEvent } from '@/lib/realtime/pusher-server';
import { createTodoFromSlash } from './todos';
import type {
  ChannelDealStage,
  ChannelKind,
  ChannelPinnedKind,
} from '@/lib/types';

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

function slugify(t: string): string {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48);
}

function pathsFor(slug?: string) {
  revalidatePath('/channels');
  if (slug) revalidatePath(`/channels/${slug}`);
}

// ─── Create channel ─────────────────────────────────────────
export async function createChannel(formData: FormData): Promise<Result<{ slug: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();

  const name = String(formData.get('name') ?? '').trim().replace(/^#/, '');
  const topic = String(formData.get('topic') ?? '').trim();
  const kind = (String(formData.get('kind') ?? 'general') as ChannelKind) || 'general';
  if (!name) return { ok: false, error: 'Name erforderlich.' };
  if (name.length > 60) return { ok: false, error: 'Name zu lang (max 60).' };

  const slug = slugify(name) || `channel-${Date.now()}`;
  const db = getDb();
  const dup = await db.query.channels.findFirst({
    where: and(eq(s.channels.workspaceId, ws.id), eq(s.channels.slug, slug)),
  });
  if (dup) return { ok: false, error: 'Channel-Name existiert bereits.' };

  const [row] = await db
    .insert(s.channels)
    .values({ workspaceId: ws.id, slug, name, topic: topic || null, kind })
    .returning();
  await db.insert(s.channelMembers).values({ channelId: row.id, userId: user.id });

  pathsFor();
  return { ok: true, slug };
}

export async function createChannelAndRedirect(formData: FormData) {
  const res = await createChannel(formData);
  if (res.ok) redirect(`/channels/${res.slug}`);
  return res;
}

// ─── Update channel meta ────────────────────────────────────
export async function updateChannelMeta(input: {
  channelId: string;
  topic?: string | null;
  kind?: ChannelKind;
  dealStage?: ChannelDealStage | null;
  archived?: boolean;
}): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await db.query.channels.findFirst({
    where: and(eq(s.channels.id, input.channelId), eq(s.channels.workspaceId, ws.id)),
  });
  if (!row) return { ok: false, error: 'Channel nicht gefunden.' };

  const update: Record<string, any> = {};
  if (input.topic !== undefined) update.topic = input.topic;
  if (input.kind) update.kind = input.kind;
  if (input.dealStage !== undefined) update.dealStage = input.dealStage;
  if (input.archived !== undefined) update.archivedAt = input.archived ? new Date() : null;

  if (Object.keys(update).length === 0) return { ok: true };
  await db.update(s.channels).set(update).where(eq(s.channels.id, input.channelId));
  pathsFor(row.slug);
  return { ok: true };
}

// ─── Mark channel as read ───────────────────────────────────
export async function markChannelRead(channelId: string): Promise<Result> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const channel = await db.query.channels.findFirst({
    where: and(eq(s.channels.id, channelId), eq(s.channels.workspaceId, ws.id)),
  });
  if (!channel) return { ok: false, error: 'Channel nicht gefunden.' };
  await db
    .insert(s.channelMembers)
    .values({ channelId, userId: user.id, lastReadAt: new Date() })
    .onConflictDoUpdate({
      target: [s.channelMembers.channelId, s.channelMembers.userId],
      set: { lastReadAt: new Date() },
    });
  pathsFor(channel.slug);
  return { ok: true };
}

// ─── Pinned items ───────────────────────────────────────────
export async function pinChannelItem(input: {
  channelId: string;
  kind: ChannelPinnedKind;
  label: string;
  targetId?: string;
  url?: string;
}): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const channel = await db.query.channels.findFirst({
    where: and(eq(s.channels.id, input.channelId), eq(s.channels.workspaceId, ws.id)),
  });
  if (!channel) return { ok: false, error: 'Channel nicht gefunden.' };

  const label = input.label.trim();
  if (!label) return { ok: false, error: 'Label erforderlich.' };

  const [posRow] = await db
    .select({ m: max(s.channelPinnedItems.position) })
    .from(s.channelPinnedItems)
    .where(eq(s.channelPinnedItems.channelId, input.channelId));
  const pos = (posRow?.m ?? -1) + 1;

  const [pinned] = await db
    .insert(s.channelPinnedItems)
    .values({
      workspaceId: ws.id,
      channelId: input.channelId,
      kind: input.kind,
      label,
      targetId: input.targetId ?? null,
      url: input.url ?? null,
      position: pos,
      pinnedById: user.id,
    })
    .returning({ id: s.channelPinnedItems.id });
  pathsFor(channel.slug);
  return { ok: true, id: pinned.id };
}

export async function unpinChannelItem(pinnedId: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await db.query.channelPinnedItems.findFirst({
    where: and(
      eq(s.channelPinnedItems.id, pinnedId),
      eq(s.channelPinnedItems.workspaceId, ws.id)
    ),
  });
  if (!row) return { ok: false, error: 'Pin nicht gefunden.' };
  await db.delete(s.channelPinnedItems).where(eq(s.channelPinnedItems.id, pinnedId));
  pathsFor();
  return { ok: true };
}

// ─── Reaction-triggered actions ─────────────────────────────
export async function reactToMessage(input: {
  messageId: string;
  emoji: string;
}): Promise<Result<{ triggered?: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();

  const msg = await db.query.messages.findFirst({
    where: eq(s.messages.id, input.messageId),
    with: { channel: { columns: { id: true, slug: true, workspaceId: true } } },
  });
  if (!msg || (msg as any).channel.workspaceId !== ws.id) {
    return { ok: false, error: 'Message nicht gefunden.' };
  }

  await db
    .insert(s.reactions)
    .values({ messageId: input.messageId, userId: user.id, emoji: input.emoji })
    .onConflictDoNothing();

  // Broadcast so other connected members' channel views refresh their
  // reaction pills without waiting for a manual reload. Channel-scoped
  // private channel is gated by /api/pusher/auth membership check.
  await triggerEvent(`private-channel-${msg.channelId}`, 'reaction.added', {
    messageId: input.messageId,
    emoji: input.emoji,
    userId: user.id,
  });

  let triggered: string | undefined;

  if (input.emoji === '🔥') {
    const existing = await db.query.todos.findFirst({
      where: and(
        eq(s.todos.workspaceId, ws.id),
        eq(s.todos.sourceMessageId, input.messageId)
      ),
    });
    if (!existing) {
      const res = await createTodoFromSlash(
        msg.channelId,
        msg.body.slice(0, 240),
        input.messageId
      );
      if (res.ok) triggered = 'todo';
    }
  } else if (input.emoji === '📎') {
    const dup = await db.query.channelPinnedItems.findFirst({
      where: and(
        eq(s.channelPinnedItems.channelId, msg.channelId),
        eq(s.channelPinnedItems.kind, 'thread'),
        eq(s.channelPinnedItems.targetId, input.messageId)
      ),
    });
    if (!dup) {
      await pinChannelItem({
        channelId: msg.channelId,
        kind: 'thread',
        label: msg.body.slice(0, 80),
        targetId: input.messageId,
      });
      triggered = 'pin';
    }
  }

  revalidatePath(`/channels/${(msg as any).channel.slug}`);
  return { ok: true, triggered };
}

export async function removeReaction(input: {
  messageId: string;
  emoji: string;
}): Promise<Result> {
  const user = await requireUser();
  const db = getDb();
  await db
    .delete(s.reactions)
    .where(
      and(
        eq(s.reactions.messageId, input.messageId),
        eq(s.reactions.userId, user.id),
        eq(s.reactions.emoji, input.emoji)
      )
    );

  // Need the channelId to address the broadcast. Cheap lookup — could be
  // denormalised onto reactions later if this shows up in profiles.
  const msg = await db.query.messages.findFirst({
    where: eq(s.messages.id, input.messageId),
    columns: { channelId: true },
  });
  if (msg) {
    await triggerEvent(`private-channel-${msg.channelId}`, 'reaction.removed', {
      messageId: input.messageId,
      emoji: input.emoji,
      userId: user.id,
    });
  }
  return { ok: true };
}

// ─── Snippets ───────────────────────────────────────────────
export async function createChannelSnippet(input: {
  title: string;
  body: string;
}): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) return { ok: false, error: 'Titel und Inhalt erforderlich.' };
  let slug = slugify(title) || 'snippet';
  let i = 1;
  while (true) {
    const dup = await db.query.channelSnippets.findFirst({
      where: and(
        eq(s.channelSnippets.workspaceId, ws.id),
        eq(s.channelSnippets.slug, slug)
      ),
    });
    if (!dup) break;
    i += 1;
    slug = `${slugify(title) || 'snippet'}-${i}`;
  }
  const [row] = await db
    .insert(s.channelSnippets)
    .values({
      workspaceId: ws.id,
      slug,
      title,
      body,
      createdById: user.id,
    })
    .returning({ id: s.channelSnippets.id });
  pathsFor();
  return { ok: true, id: row.id };
}

export async function deleteChannelSnippet(snippetId: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const snip = await db.query.channelSnippets.findFirst({
    where: and(
      eq(s.channelSnippets.id, snippetId),
      eq(s.channelSnippets.workspaceId, ws.id)
    ),
  });
  if (!snip) return { ok: false, error: 'Snippet nicht gefunden.' };
  await db.delete(s.channelSnippets).where(eq(s.channelSnippets.id, snippetId));
  pathsFor();
  return { ok: true };
}

// ─── Share Links ────────────────────────────────────────────
export async function createChannelShareLink(input: {
  channelId: string;
  onlyAnnouncements?: boolean;
  expiresInDays?: number | null;
}): Promise<Result<{ token: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const ch = await db.query.channels.findFirst({
    where: and(eq(s.channels.id, input.channelId), eq(s.channels.workspaceId, ws.id)),
  });
  if (!ch) return { ok: false, error: 'Channel nicht gefunden.' };
  const token = randomBytes(24).toString('hex');
  const expiresAt =
    input.expiresInDays && input.expiresInDays > 0
      ? new Date(Date.now() + input.expiresInDays * 86_400_000)
      : null;
  await db.insert(s.channelShareLinks).values({
    workspaceId: ws.id,
    channelId: input.channelId,
    token,
    expiresAt,
    onlyAnnouncements: input.onlyAnnouncements ? 1 : 0,
    createdById: user.id,
  });
  pathsFor(ch.slug);
  return { ok: true, token };
}

export async function revokeChannelShareLink(linkId: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await db.query.channelShareLinks.findFirst({
    where: and(
      eq(s.channelShareLinks.id, linkId),
      eq(s.channelShareLinks.workspaceId, ws.id)
    ),
  });
  if (!row) return { ok: false, error: 'Link nicht gefunden.' };
  await db.delete(s.channelShareLinks).where(eq(s.channelShareLinks.id, linkId));
  pathsFor();
  return { ok: true };
}

// ─── Link customer to channel ───────────────────────────────
export async function linkChannelToCustomer(input: {
  channelId: string;
  customerId: string | null;
}): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const ch = await db.query.channels.findFirst({
    where: and(eq(s.channels.id, input.channelId), eq(s.channels.workspaceId, ws.id)),
  });
  if (!ch) return { ok: false, error: 'Channel nicht gefunden.' };

  await db
    .delete(s.customerChannels)
    .where(eq(s.customerChannels.channelId, input.channelId));

  if (input.customerId) {
    await db.insert(s.customerChannels).values({
      customerId: input.customerId,
      channelId: input.channelId,
    });
  }
  pathsFor(ch.slug);
  return { ok: true };
}
