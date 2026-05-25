import 'server-only';
import { and, asc, desc, eq, isNull, ne, or } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';
import type { Note, NoteOverviewItem, NoteTreeItem } from '@/lib/types';

/**
 * Privacy clause for the notes table. A note with `scope='private'` is
 * visible only to its creator; `workspace` and `public` notes are
 * visible to every workspace member. The clause is composed into the
 * WHERE of every list / get query so private notes never leak.
 *
 * Public-share-token access is a different path — see getNoteByShareToken.
 */
function notesVisibilityClause(userId: string) {
  return or(ne(s.notes.scope, 'private'), eq(s.notes.createdById, userId))!;
}

// Walks a BlockNote document and concatenates inline text. Stops once we
// have enough characters to fill the list excerpt — we never need the
// whole document for a row preview.
function extractExcerpt(document: unknown, maxLen = 240): string {
  let out = '';
  const visit = (nodes: unknown): void => {
    if (out.length >= maxLen) return;
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (out.length >= maxLen) return;
      if (typeof node === 'string') {
        out += node + ' ';
        continue;
      }
      if (!node || typeof node !== 'object') continue;
      const n = node as Record<string, unknown>;
      if (typeof n.text === 'string') out += n.text + ' ';
      if (Array.isArray(n.content)) visit(n.content);
      if (Array.isArray(n.children)) visit(n.children);
    }
  };
  visit(document);
  return out.replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

// Structured per-block preview for the right pane of /notes. Walks only
// the top level (BlockNote stores nested children inside each block) so
// the preview matches what the user actually wrote, with paragraph
// breaks, headings, bullets, and quotes intact.
export type PreviewBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'heading'; text: string; level: 1 | 2 | 3 }
  | { kind: 'bullet'; text: string }
  | { kind: 'numbered'; text: string; index: number }
  | { kind: 'check'; text: string; checked: boolean }
  | { kind: 'quote'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'divider' };

function inlineText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  let out = '';
  for (const node of content) {
    if (typeof node === 'string') {
      out += node;
      continue;
    }
    if (!node || typeof node !== 'object') continue;
    const n = node as Record<string, unknown>;
    // Mentions don't have a `text` field — fall back to label so the
    // preview shows "@Anna Hoffmann" rather than dropping the mention.
    if (typeof n.text === 'string') out += n.text;
    else if (n.type === 'mention' && typeof (n as any).props?.label === 'string') {
      out += '@' + (n as any).props.label;
    } else if (Array.isArray(n.content)) {
      out += inlineText(n.content);
    }
  }
  return out;
}

export function extractPreviewBlocks(
  document: unknown,
  maxBlocks = 8
): PreviewBlock[] {
  if (!Array.isArray(document)) return [];
  const out: PreviewBlock[] = [];
  let numberedCounter = 0;

  for (const raw of document) {
    if (out.length >= maxBlocks) break;
    if (!raw || typeof raw !== 'object') continue;
    const block = raw as Record<string, unknown>;
    const type = String(block.type ?? 'paragraph');
    const text = inlineText(block.content).trim();
    const props = (block.props ?? {}) as Record<string, unknown>;

    // Skip wholly-empty content unless it's a structural block (like a
    // divider or empty heading the user is still drafting).
    if (!text && type !== 'horizontalRule' && type !== 'divider') continue;

    switch (type) {
      case 'heading': {
        const level = Math.max(1, Math.min(3, Number(props.level ?? 2))) as 1 | 2 | 3;
        out.push({ kind: 'heading', text, level });
        numberedCounter = 0;
        break;
      }
      case 'bulletListItem':
        out.push({ kind: 'bullet', text });
        numberedCounter = 0;
        break;
      case 'numberedListItem':
        numberedCounter += 1;
        out.push({ kind: 'numbered', text, index: numberedCounter });
        break;
      case 'checkListItem':
        out.push({ kind: 'check', text, checked: props.checked === true });
        numberedCounter = 0;
        break;
      case 'quote':
      case 'blockquote':
        out.push({ kind: 'quote', text });
        numberedCounter = 0;
        break;
      case 'codeBlock':
      case 'code':
        out.push({ kind: 'code', text });
        numberedCounter = 0;
        break;
      case 'horizontalRule':
      case 'divider':
        out.push({ kind: 'divider' });
        numberedCounter = 0;
        break;
      default:
        out.push({ kind: 'paragraph', text });
        numberedCounter = 0;
    }
  }
  return out;
}

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

export async function listNotesTree(
  workspaceId: string,
  userId: string
): Promise<NoteTreeItem[]> {
  const db = getDb();
  const rows = await db.query.notes.findMany({
    where: and(
      eq(s.notes.workspaceId, workspaceId),
      isNull(s.notes.archivedAt),
      notesVisibilityClause(userId)
    ),
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

// Flat list for the /notes overview. Sorted by most-recently-edited.
// Templates and archived notes are filtered out at the query level.
export async function listNotesForOverview(
  workspaceId: string,
  userId: string
): Promise<NoteOverviewItem[]> {
  const db = getDb();
  const rows = await db.query.notes.findMany({
    where: and(
      eq(s.notes.workspaceId, workspaceId),
      isNull(s.notes.archivedAt),
      eq(s.notes.isTemplate, false),
      notesVisibilityClause(userId)
    ),
    orderBy: [desc(s.notes.updatedAt)],
    columns: {
      id: true,
      title: true,
      icon: true,
      parentNoteId: true,
      scope: true,
      updatedAt: true,
      document: true,
    },
  });

  // Resolve parent titles in one pass — saves an N+1 round trip on click.
  const titleById = new Map<string, string>();
  for (const r of rows) titleById.set(r.id, r.title);

  return rows.map<NoteOverviewItem>((r) => {
    const excerpt = extractExcerpt(r.document);
    return {
      id: r.id,
      title: r.title,
      icon: r.icon ?? undefined,
      parentNoteId: r.parentNoteId ?? null,
      parentTitle: r.parentNoteId ? titleById.get(r.parentNoteId) : undefined,
      scope: (r.scope as NoteOverviewItem['scope']) ?? 'workspace',
      updatedAt: new Date(r.updatedAt).toISOString(),
      excerpt,
      isEmpty: excerpt.length === 0,
    };
  });
}

export async function getNote(
  workspaceId: string,
  userId: string,
  id: string
): Promise<Note | null> {
  const db = getDb();
  const row = await db.query.notes.findFirst({
    where: and(
      eq(s.notes.workspaceId, workspaceId),
      eq(s.notes.id, id),
      notesVisibilityClause(userId)
    ),
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

export type NoteRevisionSummary = {
  id: string;
  noteId: string;
  title: string;
  createdAt: string;
  createdByName?: string;
};

export async function listNoteRevisions(
  workspaceId: string,
  userId: string,
  noteId: string
): Promise<NoteRevisionSummary[]> {
  const db = getDb();
  // Authorize by re-applying the same visibility clause used for the
  // parent note. A user who can't read the note also can't see its
  // history — even if they guess the revision id.
  const note = await db.query.notes.findFirst({
    where: and(
      eq(s.notes.workspaceId, workspaceId),
      eq(s.notes.id, noteId),
      notesVisibilityClause(userId)
    ),
    columns: { id: true },
  });
  if (!note) return [];
  const rows = await db.query.noteRevisions.findMany({
    where: eq(s.noteRevisions.noteId, noteId),
    orderBy: [desc(s.noteRevisions.createdAt)],
    limit: 50,
    with: { createdBy: { columns: { name: true } } },
  });
  return rows.map<NoteRevisionSummary>((r) => ({
    id: r.id,
    noteId,
    title: r.title,
    createdAt: new Date(r.createdAt).toISOString(),
    createdByName: r.createdBy?.name,
  }));
}

export async function getNoteRevision(
  workspaceId: string,
  userId: string,
  noteId: string,
  revisionId: string
): Promise<{ title: string; document: unknown; createdAt: string } | null> {
  const db = getDb();
  const note = await db.query.notes.findFirst({
    where: and(
      eq(s.notes.workspaceId, workspaceId),
      eq(s.notes.id, noteId),
      notesVisibilityClause(userId)
    ),
    columns: { id: true },
  });
  if (!note) return null;
  const row = await db.query.noteRevisions.findFirst({
    where: and(eq(s.noteRevisions.noteId, noteId), eq(s.noteRevisions.id, revisionId)),
  });
  if (!row) return null;
  return {
    title: row.title,
    document: row.document,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}
