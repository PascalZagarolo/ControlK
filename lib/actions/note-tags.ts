'use server';

import { revalidatePath } from 'next/cache';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { requireUser } from '@/lib/auth/current-user';

export type Tag = {
  id: string;
  name: string;
  slug: string;
  color?: string | null;
};

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

// Normalises a user-typed tag name into our canonical slug:
// lowercase, ASCII-only letters/digits, hyphen-separated, capped at 64.
// Two tags collapse iff they share a slug, regardless of case or
// spacing the user typed.
//
// Kept non-exported because 'use server' files may only export async
// functions — if another module needs slugify later, move this into
// lib/notes/slug.ts (regular module) and import it back here.
function slugifyTag(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64);
}

async function authorizeNote(noteId: string): Promise<{ ok: true; workspaceId: string } | { ok: false; error: string }> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const note = await db.query.notes.findFirst({
    where: and(eq(s.notes.id, noteId), eq(s.notes.workspaceId, ws.id)),
    columns: { id: true, workspaceId: true },
  });
  if (!note) return { ok: false, error: 'Notiz nicht gefunden.' };
  return { ok: true, workspaceId: note.workspaceId };
}

async function findOrCreateTag(workspaceId: string, rawName: string): Promise<Tag | null> {
  const name = rawName.trim();
  if (!name) return null;
  const slug = slugifyTag(name);
  if (!slug) return null;

  const db = getDb();
  // Try existing first — by far the common case once a workspace has
  // a working tag dictionary.
  const existing = await db.query.tags.findFirst({
    where: and(eq(s.tags.workspaceId, workspaceId), eq(s.tags.slug, slug)),
    columns: { id: true, name: true, slug: true, color: true },
  });
  if (existing) return existing;

  // onConflictDoNothing handles the race where two concurrent calls
  // try to insert the same (workspace, slug). We re-read on conflict.
  const inserted = await db
    .insert(s.tags)
    .values({ workspaceId, name, slug })
    .onConflictDoNothing({ target: [s.tags.workspaceId, s.tags.slug] })
    .returning({ id: s.tags.id, name: s.tags.name, slug: s.tags.slug, color: s.tags.color });
  if (inserted[0]) return inserted[0];

  // Conflict path: someone else inserted between our read and our write.
  const reread = await db.query.tags.findFirst({
    where: and(eq(s.tags.workspaceId, workspaceId), eq(s.tags.slug, slug)),
    columns: { id: true, name: true, slug: true, color: true },
  });
  return reread ?? null;
}

export async function listWorkspaceTags(): Promise<Tag[]> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const rows = await db.query.tags.findMany({
    where: eq(s.tags.workspaceId, ws.id),
    orderBy: [asc(s.tags.name)],
    columns: { id: true, name: true, slug: true, color: true },
  });
  return rows;
}

export async function listNoteTags(noteId: string): Promise<Tag[]> {
  const auth = await authorizeNote(noteId);
  if (!auth.ok) return [];
  const db = getDb();
  const rows = await db
    .select({
      id: s.tags.id,
      name: s.tags.name,
      slug: s.tags.slug,
      color: s.tags.color,
    })
    .from(s.noteTags)
    .innerJoin(s.tags, eq(s.tags.id, s.noteTags.tagId))
    .where(eq(s.noteTags.noteId, noteId))
    .orderBy(asc(s.tags.name));
  return rows;
}

export async function addTagToNote(noteId: string, rawName: string): Promise<Result<{ tag: Tag }>> {
  const auth = await authorizeNote(noteId);
  if (!auth.ok) return auth;
  const tag = await findOrCreateTag(auth.workspaceId, rawName);
  if (!tag) return { ok: false, error: 'Tag-Name ist leer.' };

  const db = getDb();
  await db
    .insert(s.noteTags)
    .values({ noteId, tagId: tag.id })
    .onConflictDoNothing({ target: [s.noteTags.noteId, s.noteTags.tagId] });

  // Bump note updated_at so the overview list re-sorts to top.
  await db
    .update(s.notes)
    .set({ updatedAt: new Date() })
    .where(eq(s.notes.id, noteId));

  revalidatePath('/notes');
  revalidatePath(`/notes/${noteId}`);
  return { ok: true, tag };
}

export async function removeTagFromNote(noteId: string, tagId: string): Promise<Result> {
  const auth = await authorizeNote(noteId);
  if (!auth.ok) return auth;
  const db = getDb();
  await db
    .delete(s.noteTags)
    .where(and(eq(s.noteTags.noteId, noteId), eq(s.noteTags.tagId, tagId)));
  await db
    .update(s.notes)
    .set({ updatedAt: new Date() })
    .where(eq(s.notes.id, noteId));
  revalidatePath('/notes');
  revalidatePath(`/notes/${noteId}`);
  return { ok: true };
}
