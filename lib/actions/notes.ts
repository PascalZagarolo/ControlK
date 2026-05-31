'use server';

import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';
import { and, asc, desc, eq, isNull, max, ne, or } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { extractMentions } from '@/lib/notes/extract-mentions';
import { noteSearchText } from '@/lib/notes/flatten';
import { searchNotes, type NoteSearchHit } from '@/lib/db/queries/notes';
import type { NoteScope } from '@/lib/types';

/** Full-text search across the workspace's notes (title + content). */
export async function searchNotesContent(query: string): Promise<NoteSearchHit[]> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  return searchNotes(ws.id, user.id, query);
}

const REVISION_GAP_MS = 5 * 60 * 1000; // snapshot at most every 5 min

// Optimistic note creation inserts the row in the background; metadata writes
// (rename, etc.) can race ahead of it. These bound a short server-side wait so
// such writes succeed instead of failing with "Notiz nicht gefunden".
const NOTE_ROW_RETRIES = 4;
const NOTE_ROW_RETRY_MS = 150;
const sleepMs = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * Visibility predicate composed into every WHERE clause that mutates a
 * note. A private note can only be modified by its creator; workspace
 * and public notes are mutable by any workspace member. Mirrors the
 * read-side `notesVisibilityClause` in lib/db/queries/notes.ts.
 *
 * Until the row-level permission system from Sprint D lands, this is
 * the enforcement boundary — every update/delete must include it.
 */
function notesAccessClause(userId: string) {
  return or(ne(s.notes.scope, 'private'), eq(s.notes.createdById, userId))!;
}

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createNote(input: {
  /** Client-supplied id → enables optimistic navigation (the editor opens on
   *  this id before the insert returns). Validated; ignored if malformed. */
  id?: string;
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
      ...(input.id && UUID_RE.test(input.id) ? { id: input.id } : {}),
      workspaceId: ws.id,
      parentNoteId: input.parentNoteId ?? null,
      title: input.title?.trim() || 'Unbenannt',
      icon: input.icon || null,
      scope: input.scope ?? 'workspace',
      document: (input.document as any) ?? [],
      searchText: noteSearchText(input.document ?? []),
      isTemplate: input.isTemplate ?? false,
      templateKey: input.templateKey || null,
      position: String(position) as any,
      createdById: user.id,
    })
    .returning();

  // No revalidatePath: /notes is force-dynamic (re-renders on every visit),
  // so invalidation is a no-op that only forces a wasteful list re-render in
  // the action response — pure latency on the hot path.
  return { ok: true, id: row.id };
}

export async function renameNote(id: string, title: string): Promise<Result> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const value = { title: title.trim() || 'Unbenannt', updatedAt: new Date() };
  const run = () =>
    db
      .update(s.notes)
      .set(value)
      .where(and(eq(s.notes.workspaceId, ws.id), eq(s.notes.id, id), notesAccessClause(user.id)))
      .returning({ id: s.notes.id });

  // Fresh-note race: a note created optimistically inserts its row in the
  // background, so an early blur can land before the row exists. Retry briefly
  // instead of dropping the title — mirrors the document save's durability.
  let updated = await run();
  for (let i = 0; i < NOTE_ROW_RETRIES && updated.length === 0; i++) {
    await sleepMs(NOTE_ROW_RETRY_MS);
    updated = await run();
  }
  if (updated.length === 0) return { ok: false, error: 'Notiz nicht gefunden.' };
  revalidatePath('/notes');
  revalidatePath(`/notes/${id}`);
  return { ok: true };
}

export async function setNoteIcon(id: string, icon: string | null): Promise<Result> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const updated = await db
    .update(s.notes)
    .set({ icon: icon || null, updatedAt: new Date() })
    .where(
      and(
        eq(s.notes.workspaceId, ws.id),
        eq(s.notes.id, id),
        notesAccessClause(user.id)
      )
    )
    .returning({ id: s.notes.id });
  if (updated.length === 0) return { ok: false, error: 'Notiz nicht gefunden.' };
  revalidatePath(`/notes/${id}`);
  return { ok: true };
}

export async function saveNoteDocument(id: string, document: unknown): Promise<Result> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();

  // Verify the user actually has write-access to this note before we
  // touch anything (snapshot or save). Private notes are write-locked
  // to their creator.
  const accessible = await db.query.notes.findFirst({
    where: and(
      eq(s.notes.workspaceId, ws.id),
      eq(s.notes.id, id),
      notesAccessClause(user.id)
    ),
    columns: { id: true },
  });
  if (!accessible) return { ok: false, error: 'Notiz nicht gefunden.' };

  // Snapshot the prior state if the last revision is older than REVISION_GAP_MS.
  // Catch-all best-effort — never block the save itself if snapshot fails.
  try {
    const cur = await db.query.notes.findFirst({
      where: and(eq(s.notes.workspaceId, ws.id), eq(s.notes.id, id)),
      columns: { title: true, document: true },
    });
    if (cur) {
      const lastRev = await db.query.noteRevisions.findFirst({
        where: eq(s.noteRevisions.noteId, id),
        orderBy: [desc(s.noteRevisions.createdAt)],
        columns: { createdAt: true },
      });
      const gapOk = !lastRev || Date.now() - new Date(lastRev.createdAt).getTime() >= REVISION_GAP_MS;
      if (gapOk) {
        await db.insert(s.noteRevisions).values({
          noteId: id,
          title: cur.title,
          document: cur.document as any,
          createdById: user.id,
        });
      }
    }
  } catch {}

  await db
    .update(s.notes)
    .set({ document: document as any, searchText: noteSearchText(document), updatedAt: new Date() })
    .where(and(eq(s.notes.workspaceId, ws.id), eq(s.notes.id, id)));

  // Sync note_mentions — diff against existing rows. Cheap full-replace is
  // simpler than block-level diffing for v1 and the table is tiny per note.
  const mentions = extractMentions(document);
  await db.delete(s.noteMentions).where(eq(s.noteMentions.noteId, id));
  if (mentions.length > 0) {
    await db.insert(s.noteMentions).values(
      mentions.map((m) => ({
        noteId: id,
        mentionType: m.type as any,
        mentionId: m.id,
        label: m.label,
        blockId: m.blockId ?? null,
      }))
    );
  }

  // Intentionally NOT revalidating /notes/* — saves happen on debounce and
  // the client already has the latest state. But we DO revalidate entity
  // detail pages because their backlinks-panel needs to refresh.
  if (mentions.length > 0) {
    for (const m of mentions) {
      if (m.type === 'customer') revalidatePath(`/kunden/${m.id}`);
      else if (m.type === 'contract') revalidatePath(`/vertraege/${m.id}`);
      else if (m.type === 'vehicle') revalidatePath(`/flotte/${m.id}`);
    }
  }
  return { ok: true };
}

export async function archiveNote(id: string): Promise<Result> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const updated = await db
    .update(s.notes)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(s.notes.workspaceId, ws.id),
        eq(s.notes.id, id),
        notesAccessClause(user.id)
      )
    )
    .returning({ id: s.notes.id });
  if (updated.length === 0) return { ok: false, error: 'Notiz nicht gefunden.' };
  revalidatePath('/notes');
  return { ok: true };
}

export async function restoreNote(id: string): Promise<Result> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const updated = await db
    .update(s.notes)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(s.notes.workspaceId, ws.id),
        eq(s.notes.id, id),
        notesAccessClause(user.id)
      )
    )
    .returning({ id: s.notes.id });
  if (updated.length === 0) return { ok: false, error: 'Notiz nicht gefunden.' };
  revalidatePath('/notes');
  return { ok: true };
}

export async function moveNote(input: {
  id: string;
  parentNoteId: string | null;
  beforeId?: string;
  afterId?: string;
}): Promise<Result> {
  const user = await requireUser();
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

  const updated = await db
    .update(s.notes)
    .set({
      parentNoteId: input.parentNoteId,
      position: String(newPos) as any,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(s.notes.workspaceId, ws.id),
        eq(s.notes.id, input.id),
        notesAccessClause(user.id)
      )
    )
    .returning({ id: s.notes.id });
  if (updated.length === 0) return { ok: false, error: 'Notiz nicht gefunden.' };
  revalidatePath('/notes');
  return { ok: true };
}

export async function setNoteScope(id: string, scope: NoteScope): Promise<Result> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();

  // Visibility change is high-risk: it can demote a workspace note to
  // private (locking out other members) or promote a private note to
  // workspace (exposing the body). Only the creator may flip scope.
  const accessible = await db.query.notes.findFirst({
    where: and(
      eq(s.notes.workspaceId, ws.id),
      eq(s.notes.id, id),
      notesAccessClause(user.id)
    ),
    columns: { id: true, shareToken: true },
  });
  if (!accessible) return { ok: false, error: 'Notiz nicht gefunden.' };

  const patch: Record<string, unknown> = { scope, updatedAt: new Date() };
  if (scope === 'public') {
    if (!accessible.shareToken) patch.shareToken = randomBytes(24).toString('hex');
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

export async function createNoteFromTemplate(input: {
  templateKey: string;
  parentNoteId?: string | null;
}): Promise<Result<{ id: string }>> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const { getNoteTemplatesForWorkspaceTemplate } = await import('@/lib/notes/seed-templates');
  const candidates = getNoteTemplatesForWorkspaceTemplate(ws.template ?? null);
  const tpl = candidates.find((t) => t.key === input.templateKey);
  if (!tpl) return { ok: false, error: 'Template nicht gefunden.' };
  return createNote({
    title: tpl.title,
    icon: tpl.icon,
    document: tpl.document,
    parentNoteId: input.parentNoteId ?? null,
    templateKey: tpl.key,
  });
}

export async function restoreNoteRevision(
  noteId: string,
  revisionId: string
): Promise<Result> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();

  const note = await db.query.notes.findFirst({
    where: and(
      eq(s.notes.workspaceId, ws.id),
      eq(s.notes.id, noteId),
      notesAccessClause(user.id)
    ),
    columns: { id: true, title: true, document: true },
  });
  if (!note) return { ok: false, error: 'Notiz nicht gefunden.' };
  const rev = await db.query.noteRevisions.findFirst({
    where: and(eq(s.noteRevisions.noteId, noteId), eq(s.noteRevisions.id, revisionId)),
  });
  if (!rev) return { ok: false, error: 'Revision nicht gefunden.' };

  // Snapshot the CURRENT state before overwriting, so restore is itself
  // reversible.
  try {
    await db.insert(s.noteRevisions).values({
      noteId,
      title: note.title,
      document: note.document as any,
      createdById: user.id,
    });
  } catch {}

  await db
    .update(s.notes)
    .set({
      title: rev.title,
      document: rev.document as any,
      searchText: noteSearchText(rev.document),
      updatedAt: new Date(),
    })
    .where(eq(s.notes.id, noteId));

  // Re-sync mentions from the restored document
  const mentions = extractMentions(rev.document);
  await db.delete(s.noteMentions).where(eq(s.noteMentions.noteId, noteId));
  if (mentions.length > 0) {
    await db.insert(s.noteMentions).values(
      mentions.map((m) => ({
        noteId,
        mentionType: m.type as any,
        mentionId: m.id,
        label: m.label,
        blockId: m.blockId ?? null,
      }))
    );
  }

  revalidatePath(`/notes/${noteId}`);
  return { ok: true };
}

export async function duplicateNote(id: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const src = await db.query.notes.findFirst({
    where: and(
      eq(s.notes.workspaceId, ws.id),
      eq(s.notes.id, id),
      notesAccessClause(user.id)
    ),
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
      searchText: noteSearchText(src.document),
      isTemplate: false,
      templateKey: null,
      position: String(position) as any,
      createdById: user.id,
    })
    .returning();
  revalidatePath('/notes');
  return { ok: true, id: row.id };
}
