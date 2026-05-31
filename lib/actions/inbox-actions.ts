'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { getValidGoogleAccessToken } from '@/lib/auth/google-tokens';
import {
  GmailAuthError,
  archiveMessage,
  markMessageRead,
} from '@/lib/google/gmail';
import { createTodo } from './todos';

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

// Snooze presets — keep these in one place so future UI changes
// (e.g. a custom date picker) stay aligned with the keyboard-shortcut
// defaults. Values are computed at call time so they always resolve
// relative to *now*.
export async function resolveSnoozePreset(
  preset: 'three_hours' | 'tomorrow' | 'monday'
): Promise<Date> {
  const now = new Date();
  if (preset === 'three_hours') {
    return new Date(now.getTime() + 3 * 60 * 60_000);
  }
  if (preset === 'tomorrow') {
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    t.setHours(9, 0, 0, 0);
    return t;
  }
  // monday
  const m = new Date(now);
  const dayOfWeek = m.getDay(); // 0 Sun … 6 Sat
  const daysUntilMonday = (8 - dayOfWeek) % 7 || 7;
  m.setDate(m.getDate() + daysUntilMonday);
  m.setHours(9, 0, 0, 0);
  return m;
}

async function loadOwnedItem(itemId: string) {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  // userId match is the privacy boundary: another workspace member must
  // not be able to mutate this user's inbox by passing the item id.
  const item = await db.query.inboxItems.findFirst({
    where: and(
      eq(s.inboxItems.id, itemId),
      eq(s.inboxItems.workspaceId, ws.id),
      eq(s.inboxItems.userId, user.id)
    ),
  });
  if (!item) return null;
  return { user, item };
}

async function pushGmailUpdate(
  userId: string,
  item: typeof s.inboxItems.$inferSelect,
  op: 'archive' | 'markRead'
): Promise<void> {
  if (item.sourceType !== 'email_gmail') return;
  const token = await getValidGoogleAccessToken(userId);
  if (!token) {
    // No modify access (yet). Local update still goes through — the
    // user will see the action take effect in our UI and discover the
    // upgrade prompt in Settings when they hit a future scope mismatch.
    return;
  }
  try {
    if (op === 'archive') await archiveMessage(token, item.sourceId);
    if (op === 'markRead') await markMessageRead(token, item.sourceId);
  } catch (e) {
    if (e instanceof GmailAuthError) {
      // 403 typically means we have readonly but not modify. Don't
      // surface to the user — local update already succeeded.
      return;
    }
    console.warn(`[inbox] Gmail ${op} failed for ${item.sourceId}:`, e);
  }
}

export async function archiveInboxItem(itemId: string): Promise<Result> {
  const owned = await loadOwnedItem(itemId);
  if (!owned) return { ok: false, error: 'Nicht gefunden.' };
  const { user, item } = owned;
  const db = getDb();

  await pushGmailUpdate(user.id, item, 'archive');

  await db
    .update(s.inboxItems)
    .set({
      isArchived: true,
      archivedAt: new Date(),
      // Archiving implies read — keeps the unread counter honest.
      isRead: true,
      updatedAt: new Date(),
    })
    .where(eq(s.inboxItems.id, itemId));

  revalidatePath('/');
  return { ok: true };
}

export async function markInboxItemRead(itemId: string): Promise<Result> {
  const owned = await loadOwnedItem(itemId);
  if (!owned) return { ok: false, error: 'Nicht gefunden.' };
  const { user, item } = owned;
  const db = getDb();

  if (item.isRead) return { ok: true };

  await pushGmailUpdate(user.id, item, 'markRead');

  await db
    .update(s.inboxItems)
    .set({ isRead: true, updatedAt: new Date() })
    .where(eq(s.inboxItems.id, itemId));

  revalidatePath('/');
  return { ok: true };
}

export async function snoozeInboxItem(
  itemId: string,
  preset: 'three_hours' | 'tomorrow' | 'monday'
): Promise<Result<{ until: string }>> {
  const owned = await loadOwnedItem(itemId);
  if (!owned) return { ok: false, error: 'Nicht gefunden.' };
  const db = getDb();

  const until = await resolveSnoozePreset(preset);

  await db
    .update(s.inboxItems)
    .set({ snoozedUntil: until, updatedAt: new Date() })
    .where(eq(s.inboxItems.id, itemId));

  revalidatePath('/');
  return { ok: true, until: until.toISOString() };
}

export async function createTodoFromInboxItem(
  itemId: string
): Promise<Result<{ todoId: string }>> {
  const owned = await loadOwnedItem(itemId);
  if (!owned) return { ok: false, error: 'Nicht gefunden.' };
  const { item } = owned;

  // Guard against a double-fire (rapid clicks / replay): if the item was
  // already archived, a todo was almost certainly already created from it.
  // Bail instead of silently producing a duplicate.
  if (item.isArchived) {
    return { ok: false, error: 'Aus dieser Nachricht wurde bereits ein Todo erstellt.' };
  }

  // Title prefers subject, falls back to sender + snippet so the todo
  // is still meaningful for senderless / no-subject messages.
  const title =
    item.subject?.trim() ||
    `${item.senderName}: ${(item.preview ?? '').slice(0, 80)}`.trim() ||
    'Nachricht';

  // Description carries the email context so the todo is self-sufficient
  // even after the inbox item is archived. We don't link via FK — the
  // inbox row can be deleted later without breaking the todo.
  const lines: string[] = [];
  if (item.senderName) lines.push(`Von: ${item.senderName}`);
  if (item.senderEmail) lines.push(`E-Mail: ${item.senderEmail}`);
  if (item.preview) lines.push('', item.preview);
  if (item.sourceType === 'email_gmail') {
    lines.push(
      '',
      `Gmail: https://mail.google.com/mail/u/0/#inbox/${item.sourceId}`
    );
  }
  const description = lines.join('\n');

  const result = await createTodo({ title, description });
  if (!result.ok) return result;

  // Archive after creating the todo so the card leaves the stack —
  // user already captured the action.
  await archiveInboxItem(itemId);

  return { ok: true, todoId: result.id };
}
