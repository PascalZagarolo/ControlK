'use server';

import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { triggerEvent } from '@/lib/realtime/pusher-server';

/**
 * Wake up all todos snoozed with trigger=customer_reply for a given customer.
 * Called from sendMessage when a customer-contact replies in a channel.
 */
export async function wakeTodosForCustomerReply(
  workspaceId: string,
  customerId: string,
  actorId: string | null
): Promise<number> {
  const db = getDb();

  // Find snoozed todos: customer_reply trigger matching this customer
  // (either via snooze_trigger.ref OR via todos.customer_id when ref is empty)
  const candidates = await db.query.todos.findMany({
    where: and(
      eq(s.todos.workspaceId, workspaceId),
      isNotNull(s.todos.snoozeUntil),
      sql`${s.todos.snoozeTrigger}->>'kind' = 'customer_reply'`,
      sql`(${s.todos.snoozeTrigger}->>'ref' IS NULL OR ${s.todos.snoozeTrigger}->>'ref' = ${customerId} OR ${s.todos.customerId} = ${customerId})`
    ),
    columns: { id: true },
  });

  if (candidates.length === 0) return 0;

  const ids = candidates.map((c) => c.id);
  await db
    .update(s.todos)
    .set({ snoozeUntil: null, snoozeTrigger: null, updatedAt: new Date() })
    .where(inArray(s.todos.id, ids));

  await db.insert(s.todoActivity).values(
    ids.map((id) => ({
      todoId: id,
      actorId,
      kind: 'snoozed' as const,
      payload: { wokeUp: true, reason: 'customer_reply', customerId },
    }))
  );

  for (const id of ids) {
    await triggerEvent(`private-workspace-${workspaceId}-todos`, 'todo.snoozed', { todoId: id, woke: true });
  }

  return ids.length;
}
