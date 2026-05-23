'use server';

import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';
import { and, asc, eq, isNull, max } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import type { NoteScope } from '@/lib/types';

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

async function nextPosition(workspaceId: string, parentNoteId: string | null): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ pos: max(s.notes.position) })
    .from(s.notes)
    .where(
      and(
        eq(s.notes.workspaceId, workspaceId),
        parentNoteId
          ? eq(s.notes.parentNoteId, parentNoteId)
          : isNull(s.notes.parentNoteId)
      )
    );
  const cur = Number(rows[0]?.pos ?? 0);
  return cur + 1000;
}

export async function createNote(input: {
  title?: string;
  icon?: string;
  parentNoteId?: string | null;
  document?: unknown;
  scope?: NoteScope;
  isTemplate?: boolean;
  templateKey?: string;
}): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();

  const position = await nextPosition(ws.id, input.parentNoteId ?? null);

  const [row] = await db
    .insert(s.notes)
    .values({
      workspaceId: ws.id,
      parentNoteId: input.parentNoteId ?? null,
      title: input.title?.trim() || 'Unbenannt',
      icon: input.icon || null,
      scope: input.scope ?? 'workspace',
      document: (input.document as any) ?? [],
      isTemplate: input.isTemplate ?? false,
      templateKey: input.templateKey || null,
      position: String(position) as any,
      createdById: user.id,
    })
    .returning();

  revalidatePath('/notes');
  return { ok: true, id: row.id };
}

export async function renameNote(id: string, title: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  await db
    .update(s.notes)
    .set({ title: title.trim() || 'Unbenannt', updatedAt: new Date() })
    .where(and(eq(s.notes.workspaceId, ws.id), eq(s.notes.id, id)));
  revalidatePath('/notes');
  revalidatePath(`/notes/${id}`);
  return { ok: true };
}

export async function setNoteIcon(id: string, icon: string | null): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  await db
    .update(s.notes)
    .set({ icon: icon || null, updatedAt: new Date() })
    .where(and(eq(s.notes.workspaceId, ws.id), eq(s.notes.id, id)));
  revalidatePath(`/notes/${id}`);
  return { ok: true };
}

export async function saveNoteDocument(id: string, document: unknown): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  await db
    .update(s.notes)
    .set({ document: document as any, updatedAt: new Date() })
    .where(and(eq(s.notes.workspaceId, ws.id), eq(s.notes.id, id)));
  // Intentionally NOT revalidating — saves happen on debounce and we don't
  // want to thrash the cache. The client already has the latest state.
  return { ok: true };
}

export async function archiveNote(id: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  await db
    .update(s.notes)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(s.notes.workspaceId, ws.id), eq(s.notes.id, id)));
  revalidatePath('/notes');
  return { ok: true };
}

export async function restoreNote(id: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  await db
    .update(s.notes)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(and(eq(s.notes.workspaceId, ws.id), eq(s.notes.id, id)));
  revalidatePath('/notes');
  return { ok: true };
}

export async function moveNote(input: {
  id: string;
  parentNoteId: string | null;
  beforeId?: string;
  afterId?: string;
}): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();

  // Simple positioning: compute midpoint between siblings, or append.
  let newPos: number;
  const beforeRow = input.beforeId
    ? await db.query.notes.findFirst({
        where: and(eq(s.notes.workspaceId, ws.id), eq(s.notes.id, input.beforeId)),
        columns: { position: true },
      })
    : null;
  const afterRow = input.afterId
    ? await db.query.notes.findFirst({
        where: and(eq(s.notes.workspaceId, ws.id), eq(s.notes.id, input.afterId)),
        columns: { position: true },
      })
    : null;

  if (beforeRow && afterRow) {
    newPos = (Number(beforeRow.position) + Number(afterRow.position)) / 2;
  } else if (beforeRow) {
    newPos = Number(beforeRow.position) + 1000;
  } else if (afterRow) {
    newPos = Number(afterRow.position) - 1000;
  } else {
    newPos = await nextPosition(ws.id, input.parentNoteId);
  }

  await db
    .update(s.notes)
    .set({
      parentNoteId: input.parentNoteId,
      position: String(newPos) as any,
      updatedAt: new Date(),
    })
    .where(and(eq(s.notes.workspaceId, ws.id), eq(s.notes.id, input.id)));
  revalidatePath('/notes');
  return { ok: true };
}

export async function setNoteScope(id: string, scope: NoteScope): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();

  const patch: Record<string, unknown> = { scope, updatedAt: new Date() };
  if (scope === 'public') {
    const cur = await db.query.notes.findFirst({
      where: and(eq(s.notes.workspaceId, ws.id), eq(s.notes.id, id)),
      columns: { shareToken: true },
    });
    if (!cur?.shareToken) patch.shareToken = randomBytes(24).toString('hex');
  } else {
    patch.shareToken = null;
  }
  await db
    .update(s.notes)
    .set(patch)
    .where(and(eq(s.notes.workspaceId, ws.id), eq(s.notes.id, id)));
  revalidatePath(`/notes/${id}`);
  return { ok: true };
}

export async function duplicateNote(id: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const src = await db.query.notes.findFirst({
    where: and(eq(s.notes.workspaceId, ws.id), eq(s.notes.id, id)),
  });
  if (!src) return { ok: false, error: 'Notiz nicht gefunden.' };
  const position = await nextPosition(ws.id, src.parentNoteId ?? null);
  const [row] = await db
    .insert(s.notes)
    .values({
      workspaceId: ws.id,
      parentNoteId: src.parentNoteId,
      title: `${src.title} (Kopie)`,
      icon: src.icon,
      scope: 'workspace',
      document: src.document as any,
      isTemplate: false,
      templateKey: null,
      position: String(position) as any,
      createdById: user.id,
    })
    .returning();
  revalidatePath('/notes');
  return { ok: true, id: row.id };
}
