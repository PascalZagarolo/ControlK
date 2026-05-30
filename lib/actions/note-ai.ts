'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { createTodoFromForm } from '@/lib/actions/todos';
import { aiGenerateJSON, aiGatewayConfigured, AI_MODEL_FAST } from '@/lib/ai/gateway';

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

/** Recursively flatten a BlockNote/Tiptap-ish jsonb document to plain text. */
function flattenDoc(node: any): string {
  if (node == null) return '';
  if (Array.isArray(node)) return node.map(flattenDoc).join('\n');
  let out = '';
  if (typeof node.text === 'string') out += node.text;
  if (Array.isArray(node.content)) out += node.content.map(flattenDoc).join('');
  if (Array.isArray(node.children)) out += '\n' + node.children.map(flattenDoc).join('\n');
  return out;
}

/**
 * Extracts concrete action items from a note's content and creates a todo for
 * each. One click turns "meeting notes" into a real task list. Returns what it
 * created so the UI can confirm.
 */
export async function extractNoteTodos(
  noteId: string
): Promise<Result<{ created: number; items: string[] }>> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  if (!aiGatewayConfigured()) return { ok: false, error: 'KI ist nicht konfiguriert.' };

  const db = getDb();
  const note = await db.query.notes.findFirst({
    where: and(eq(s.notes.workspaceId, ws.id), eq(s.notes.id, noteId)),
    columns: { document: true, title: true },
  });
  if (!note) return { ok: false, error: 'Notiz nicht gefunden.' };

  const text = flattenDoc(note.document).replace(/\n{3,}/g, '\n\n').slice(0, 6000).trim();
  if (!text) return { ok: true, created: 0, items: [] };

  let items: string[] = [];
  try {
    const parsed = await aiGenerateJSON<{ actions?: string[] }>({
      model: AI_MODEL_FAST,
      maxOutputTokens: 400,
      system:
        'Du extrahierst konkrete, umsetzbare Aufgaben aus einer Notiz. Antworte NUR mit JSON: ' +
        '{ "actions": string[] }. Jede Aufgabe ein kurzer, eigenständiger Satz im Imperativ. ' +
        'Nur echte To-dos, kein Fließtext, keine Erfindungen. Leeres Array, wenn keine.',
      prompt: `Titel: ${note.title}\n\nNotiz:\n${text}`,
    });
    items = Array.isArray(parsed?.actions)
      ? parsed!.actions.filter((a) => typeof a === 'string' && a.trim()).map((a) => a.trim()).slice(0, 15)
      : [];
  } catch (e) {
    console.error('[note-ai] extract failed', e);
    return { ok: false, error: 'Extraktion fehlgeschlagen.' };
  }

  let created = 0;
  for (const item of items) {
    const fd = new FormData();
    fd.set('title', item.slice(0, 200));
    const res = await createTodoFromForm(fd);
    if (res.ok) created++;
  }
  if (created > 0) revalidatePath('/todos');
  return { ok: true, created, items };
}
