'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { getDb, hasDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { triggerEvent } from '@/lib/realtime/pusher-server';
import { wakeTodosForCustomerReply } from './todo-wakeup';

export async function sendMessage(input: {
  channelId: string;
  body: string;
  parentId?: string;
  replyToId?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!hasDb()) return { ok: false, error: 'Database not configured.' };
  const user = await requireUser();
  const body = input.body.trim();
  if (!body) return { ok: false, error: 'Empty message.' };

  const db = getDb();

  // Guard: replyToId must point to a message in the same channel. We
  // silently drop the pointer if it doesn't — the send still goes through
  // as a regular message so a stale UI state can't block the user.
  let replyToId: string | undefined = input.replyToId;
  if (replyToId) {
    const target = await db.query.messages.findFirst({
      where: and(eq(s.messages.id, replyToId), eq(s.messages.channelId, input.channelId)),
      columns: { id: true },
    });
    if (!target) replyToId = undefined;
  }

  const [row] = await db
    .insert(s.messages)
    .values({
      channelId: input.channelId,
      authorId: user.id,
      parentId: input.parentId,
      replyToId,
      body,
    })
    .returning();

  await triggerEvent(`private-channel-${input.channelId}`, 'message.new', {
    id: row.id,
    authorId: user.id,
    body,
    parentId: input.parentId ?? null,
    replyToId: replyToId ?? null,
    createdAt: row.createdAt.toISOString(),
  });

  // Revalidate channel page (best effort — slug not known here, so we revalidate the layout)
  const channel = await db.query.channels.findFirst({ where: eq(s.channels.id, input.channelId) });
  if (channel) revalidatePath(`/channels/${channel.slug}`);

  // Mention extraction + notification fan-out. Best-effort: if any step
  // throws (workspace lookup failure, notifications insert), the message
  // still went through. We swallow rather than reverse the send.
  if (channel) {
    try {
      await notifyMentions({
        body,
        authorId: user.id,
        authorName: user.name,
        workspaceId: channel.workspaceId,
        channelSlug: channel.slug,
        messageId: row.id,
      });
    } catch (e) {
      console.warn('[sendMessage] mention notification failed:', e);
    }
  }

  // Trigger-Snooze wake-up: if the author's email matches a registered customer-contact
  // for any customer linked to this channel, wake any todos snoozed for that customer.
  try {
    const me = await db.query.users.findFirst({ where: eq(s.users.id, user.id) });
    if (me?.email) {
      const matches = await db
        .select({ customerId: s.customers.id, workspaceId: s.customers.workspaceId })
        .from(s.customerContacts)
        .innerJoin(s.customers, eq(s.customerContacts.customerId, s.customers.id))
        .innerJoin(
          s.customerChannels,
          and(
            eq(s.customerChannels.customerId, s.customers.id),
            eq(s.customerChannels.channelId, input.channelId)
          )
        )
        .where(eq(s.customerContacts.email, me.email));
      for (const m of matches) {
        await wakeTodosForCustomerReply(m.workspaceId, m.customerId, user.id);
      }
    }
  } catch {
    // wake-up is best-effort; never let it block message sending
  }

  return { ok: true, id: row.id };
}

/**
 * Match `@firstname` (and `@First.Last`) tokens in a message body
 * against workspace members and insert one notification row per match
 * (deduped). Skips self-mentions — there's no value in pinging
 * yourself. Used by sendMessage to feed the Foyer's NotificationStack.
 *
 * Resolution strategy is intentionally simple for V1:
 *   - lowercase match on the user's first name (split on whitespace)
 *   - second-pass match on lowercased full name with spaces stripped
 *
 * Ambiguous matches (two members share a first name) raise *all* of
 * them — better to over-notify than to silently miss. When we add an
 * autocomplete composer, we'll switch to unambiguous @[id:label]
 * syntax and this regex becomes a fallback for hand-typed mentions.
 */
async function notifyMentions(input: {
  body: string;
  authorId: string;
  authorName: string;
  workspaceId: string;
  channelSlug: string;
  messageId: string;
}): Promise<void> {
  // Token shape: `@` followed by 2+ letters/digits, optionally with
  // a dot or hyphen for "@First.Last" / "@firstname-foo" patterns.
  const tokens = Array.from(input.body.matchAll(/@([\p{L}][\p{L}\p{N}._-]+)/gu)).map(
    (m) => m[1].toLowerCase()
  );
  if (tokens.length === 0) return;

  const db = getDb();
  const memberRows = await db.query.workspaceMembers.findMany({
    where: eq(s.workspaceMembers.workspaceId, input.workspaceId),
    with: { user: { columns: { id: true, name: true } } },
  });

  const mentionedIds = new Set<string>();
  for (const token of tokens) {
    for (const m of memberRows) {
      if (!m.user) continue;
      if (m.user.id === input.authorId) continue;
      const first = m.user.name.split(/\s+/)[0]?.toLowerCase() ?? '';
      const fullCompact = m.user.name.toLowerCase().replace(/\s+/g, '');
      if (token === first || token === fullCompact) {
        mentionedIds.add(m.user.id);
      }
    }
  }
  if (mentionedIds.size === 0) return;

  const previewSource = input.body.replace(/\s+/g, ' ').trim();
  const preview =
    previewSource.length > 140 ? previewSource.slice(0, 140) + '…' : previewSource;

  await db.insert(s.notifications).values(
    Array.from(mentionedIds).map((userId) => ({
      userId,
      workspaceId: input.workspaceId,
      kind: 'mention' as const,
      title: input.authorName,
      excerpt: preview,
      sourceUrl: `/channels/${input.channelSlug}#message-${input.messageId}`,
      actorId: input.authorId,
    }))
  );
}

/**
 * NOTE: Reaction actions live in `lib/actions/channels.ts`
 * (`reactToMessage` / `removeReaction`). The previous duplicate
 * `addReaction` here was dead code — message-item.tsx only ever
 * called the channels.ts variant, and that one carries the emoji-
 * trigger behaviour (🔥 → spawn todo, 📎 → pin) plus the realtime
 * broadcast. Don't re-add a parallel implementation.
 */

/**
 * Edits the body of a message the caller authored. Other authors get
 * a "Nicht autorisiert" — only the author may rewrite their own words.
 * editedAt is stamped on each successful edit so the UI can show
 * "(bearbeitet)".
 *
 * Broadcasts `message.edited` so other connected members refresh.
 */
export async function editMessage(input: {
  messageId: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasDb()) return { ok: false, error: 'Database not configured.' };
  const user = await requireUser();
  const body = input.body.trim();
  if (!body) return { ok: false, error: 'Leere Nachricht.' };

  const db = getDb();
  const updated = await db
    .update(s.messages)
    .set({ body, editedAt: new Date() })
    .where(
      and(
        eq(s.messages.id, input.messageId),
        eq(s.messages.authorId, user.id),
        // Don't allow editing a deleted message — once tombstoned, it stays.
        isNull(s.messages.deletedAt)
      )
    )
    .returning({ id: s.messages.id, channelId: s.messages.channelId });

  if (updated.length === 0) {
    return { ok: false, error: 'Nachricht nicht gefunden oder keine Berechtigung.' };
  }

  await triggerEvent(
    `private-channel-${updated[0].channelId}`,
    'message.edited',
    { id: updated[0].id, body }
  );

  const channel = await db.query.channels.findFirst({
    where: eq(s.channels.id, updated[0].channelId),
    columns: { slug: true },
  });
  if (channel) revalidatePath(`/channels/${channel.slug}`);

  return { ok: true };
}

/**
 * Soft-deletes a message. The row stays (so threads and reactions
 * don't lose their anchor) but `deletedAt` is set and queries filter
 * it out of normal listings. The UI can render a "Diese Nachricht
 * wurde gelöscht" tombstone in its place if it wants thread context.
 *
 * Only the author may delete. (Future: admin-override in Sprint D.)
 */
export async function deleteMessage(input: {
  messageId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasDb()) return { ok: false, error: 'Database not configured.' };
  const user = await requireUser();
  const db = getDb();

  const deleted = await db
    .update(s.messages)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(s.messages.id, input.messageId),
        eq(s.messages.authorId, user.id),
        isNull(s.messages.deletedAt)
      )
    )
    .returning({ id: s.messages.id, channelId: s.messages.channelId });

  if (deleted.length === 0) {
    return { ok: false, error: 'Nachricht nicht gefunden oder keine Berechtigung.' };
  }

  await triggerEvent(
    `private-channel-${deleted[0].channelId}`,
    'message.deleted',
    { id: deleted[0].id }
  );

  const channel = await db.query.channels.findFirst({
    where: eq(s.channels.id, deleted[0].channelId),
    columns: { slug: true },
  });
  if (channel) revalidatePath(`/channels/${channel.slug}`);

  return { ok: true };
}
