'use server';

import { revalidatePath } from 'next/cache';
import { and, asc, eq, ne, or } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * Defensive: confirm the caller can actually see the note they're
 * linking from. Without this a leaked private-note id could be used
 * to spam mentions onto someone else's private note.
 */
async function userCanLinkFromNote(
  noteId: string,
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const db = getDb();
  const row = await db.query.notes.findFirst({
    where: and(
      eq(s.notes.workspaceId, workspaceId),
      eq(s.notes.id, noteId),
      or(ne(s.notes.scope, 'private'), eq(s.notes.createdById, userId))!
    ),
    columns: { id: true },
  });
  return !!row;
}

/**
 * Slash-command actions invoked from inside a note. They spawn workspace
 * entities (todos, calendar events) and link them back via the existing
 * note_mentions table so they show up in the entity's backlinks panel and
 * survive document re-saves.
 */
export async function createTodoFromNote(input: {
  noteId: string;
  title: string;
}): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();

  const title = input.title.trim();
  if (!title) return { ok: false, error: 'Titel fehlt.' };

  if (!(await userCanLinkFromNote(input.noteId, ws.id, user.id))) {
    return { ok: false, error: 'Notiz nicht gefunden.' };
  }

  const firstGroup = await db.query.todoGroups.findFirst({
    where: eq(s.todoGroups.workspaceId, ws.id),
    orderBy: [asc(s.todoGroups.position)],
  });

  const [row] = await db
    .insert(s.todos)
    .values({
      workspaceId: ws.id,
      groupId: firstGroup?.id ?? null,
      title,
      description: `Aus Notiz erstellt.`,
      priority: 'mittel',
      status: 'offen',
      assigneeId: user.id,
      createdById: user.id,
    } as any)
    .returning();

  await db.insert(s.noteMentions).values({
    noteId: input.noteId,
    mentionType: 'todo' as any,
    mentionId: row.id,
    label: title,
  });

  revalidatePath('/todos');
  return { ok: true, id: row.id };
}

export async function createEventFromNote(input: {
  noteId: string;
  title: string;
  startsAt: string;
  durationMinutes?: number;
}): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();

  const title = input.title.trim();
  if (!title) return { ok: false, error: 'Titel fehlt.' };

  if (!(await userCanLinkFromNote(input.noteId, ws.id, user.id))) {
    return { ok: false, error: 'Notiz nicht gefunden.' };
  }

  const start = new Date(input.startsAt);
  if (isNaN(start.getTime())) return { ok: false, error: 'Ungültiges Datum.' };
  const end = new Date(start.getTime() + (input.durationMinutes ?? 60) * 60 * 1000);

  const [row] = await db
    .insert(s.calendarEvents)
    .values({
      workspaceId: ws.id,
      kind: 'meeting',
      title,
      detail: `Aus Notiz erstellt.`,
      startsAt: start,
      endsAt: end,
    } as any)
    .returning();

  await db.insert(s.noteMentions).values({
    noteId: input.noteId,
    mentionType: 'event' as any,
    mentionId: row.id,
    label: title,
  });

  revalidatePath('/kalender');
  // Surrogate, since user.id isn't currently captured on calendar_events
  void user;
  return { ok: true, id: row.id };
}
