import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';

export type NoteBacklink = {
  noteId: string;
  noteTitle: string;
  noteIcon?: string;
  noteUpdatedAt: string;
  mentionCount: number;
};

export async function listBacklinksFor(
  workspaceId: string,
  type: 'customer' | 'contract' | 'vehicle' | 'channel' | 'event' | 'todo' | 'user',
  entityId: string
): Promise<NoteBacklink[]> {
  const db = getDb();
  const rows = await db
    .select({
      noteId: s.noteMentions.noteId,
      title: s.notes.title,
      icon: s.notes.icon,
      updatedAt: s.notes.updatedAt,
    })
    .from(s.noteMentions)
    .innerJoin(s.notes, eq(s.noteMentions.noteId, s.notes.id))
    .where(
      and(
        eq(s.noteMentions.mentionType, type),
        eq(s.noteMentions.mentionId, entityId),
        eq(s.notes.workspaceId, workspaceId)
      )
    )
    .orderBy(desc(s.notes.updatedAt));

  // Collapse multiple mentions of the same entity in the same note
  const map = new Map<string, NoteBacklink>();
  for (const r of rows) {
    const existing = map.get(r.noteId);
    if (existing) {
      existing.mentionCount += 1;
    } else {
      map.set(r.noteId, {
        noteId: r.noteId,
        noteTitle: r.title,
        noteIcon: r.icon ?? undefined,
        noteUpdatedAt: new Date(r.updatedAt).toISOString(),
        mentionCount: 1,
      });
    }
  }
  return Array.from(map.values());
}
