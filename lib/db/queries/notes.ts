import 'server-only';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';
import type { Note, NoteTreeItem } from '@/lib/types';

function toNote(row: any): Note {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    parentNoteId: row.parentNoteId ?? null,
    title: row.title,
    icon: row.icon ?? undefined,
    coverImageUrl: row.coverImageUrl ?? undefined,
    scope: row.scope ?? 'workspace',
    shareToken: row.shareToken ?? undefined,
    document: row.document ?? [],
    isTemplate: !!row.isTemplate,
    templateKey: row.templateKey ?? undefined,
    position: Number(row.position ?? 0),
    archivedAt: row.archivedAt ? new Date(row.archivedAt).toISOString() : undefined,
    createdById: row.createdById ?? undefined,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export async function listNotesTree(workspaceId: string): Promise<NoteTreeItem[]> {
  const db = getDb();
  const rows = await db.query.notes.findMany({
    where: and(eq(s.notes.workspaceId, workspaceId), isNull(s.notes.archivedAt)),
    orderBy: [asc(s.notes.position), asc(s.notes.createdAt)],
    columns: {
      id: true,
      title: true,
      icon: true,
      parentNoteId: true,
      position: true,
      isTemplate: true,
      scope: true,
      archivedAt: true,
    },
  });
  // childCount for tree-rendering (no need to recurse — one pass)
  const childCounts = new Map<string, number>();
  for (const r of rows) {
    if (r.parentNoteId) {
      childCounts.set(r.parentNoteId, (childCounts.get(r.parentNoteId) ?? 0) + 1);
    }
  }
  return rows.map<NoteTreeItem>((r) => ({
    id: r.id,
    title: r.title,
    icon: r.icon ?? undefined,
    parentNoteId: r.parentNoteId ?? null,
    position: Number(r.position ?? 0),
    isTemplate: !!r.isTemplate,
    archived: !!r.archivedAt,
    scope: (r.scope as any) ?? 'workspace',
    childCount: childCounts.get(r.id) ?? 0,
  }));
}

export async function getNote(workspaceId: string, id: string): Promise<Note | null> {
  const db = getDb();
  const row = await db.query.notes.findFirst({
    where: and(eq(s.notes.workspaceId, workspaceId), eq(s.notes.id, id)),
  });
  return row ? toNote(row) : null;
}

export async function getNoteByShareToken(token: string): Promise<Note | null> {
  const db = getDb();
  const row = await db.query.notes.findFirst({
    where: and(eq(s.notes.shareToken, token), eq(s.notes.scope, 'public')),
  });
  if (!row || row.archivedAt) return null;
  return toNote(row);
}
