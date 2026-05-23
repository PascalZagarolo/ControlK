'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb, hasDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { triggerEvent } from '@/lib/realtime/pusher-server';
import { wakeTodosForCustomerReply } from './todo-wakeup';

export async function sendMessage(input: {
  channelId: string;
  body: string;
  parentId?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!hasDb()) return { ok: false, error: 'Database not configured.' };
  const user = await requireUser();
  const body = input.body.trim();
  if (!body) return { ok: false, error: 'Empty message.' };

  const db = getDb();
  const [row] = await db
    .insert(s.messages)
    .values({
      channelId: input.channelId,
      authorId: user.id,
      parentId: input.parentId,
      body,
    })
    .returning();

  await triggerEvent(`channel-${input.channelId}`, 'message.new', {
    id: row.id,
    authorId: user.id,
    body,
    parentId: input.parentId ?? null,
    createdAt: row.createdAt.toISOString(),
  });

  // Revalidate channel page (best effort — slug not known here, so we revalidate the layout)
  const channel = await db.query.channels.findFirst({ where: eq(s.channels.id, input.channelId) });
  if (channel) revalidatePath(`/channels/${channel.slug}`);

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

export async function addReaction(input: { messageId: string; emoji: string }) {
  if (!hasDb()) return { ok: false as const, error: 'Database not configured.' };
  const user = await requireUser();
  const db = getDb();
  await db
    .insert(s.reactions)
    .values({ messageId: input.messageId, userId: user.id, emoji: input.emoji })
    .onConflictDoNothing();
  return { ok: true as const };
}
