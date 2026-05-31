import Link from 'next/link';
import { getNote } from '@/lib/db/queries/notes';
import { listNoteTags, listWorkspaceTags } from '@/lib/actions/note-tags';
import { refreshMentionStatus } from '@/lib/notes/refresh-mention-status';
import { NoteTitleInput } from '@/components/notes/note-title-input';
import { NoteEditor } from '@/components/notes/note-editor';
import { TagsBar } from '@/components/notes/tags-bar';
import { NoteToolbar } from './note-toolbar';

type Scope = 'business' | 'private';

/**
 * Server-rendered body for an EXISTING note — the proven data path, now
 * wrapped in a Suspense boundary so it streams (instant shell + skeleton)
 * instead of blocking navigation. FreshGate renders this only when the id is
 * not a just-created optimistic note.
 *
 * A short retry covers the narrow window where someone reloads immediately
 * after creation before the background insert commits. We RENDER a not-found
 * notice rather than calling `notFound()` — this subtree may be rendered on
 * the server even when FreshGate discards it on the client, and a thrown
 * notFound would wrongly surface the 404 boundary in that case.
 */
export async function ExistingNoteBody({
  workspaceId,
  userId,
  noteId,
  workspaceScope,
}: {
  workspaceId: string;
  userId: string;
  noteId: string;
  workspaceScope: Scope;
}) {
  let note = await getNote(workspaceId, userId, noteId);
  for (let i = 0; i < 3 && !note; i++) {
    await new Promise((r) => setTimeout(r, 200));
    note = await getNote(workspaceId, userId, noteId);
  }

  if (!note) {
    return (
      <div className="mt-16 flex flex-col items-center gap-3 text-center">
        <p className="text-[14px] text-ink-200">Diese Notiz existiert nicht (mehr).</p>
        <Link
          href="/notes"
          className="rounded-md border border-white/10 px-3 py-1.5 text-[12.5px] text-ink-200 transition-colors hover:bg-white/[0.04]"
        >
          Zur Übersicht
        </Link>
      </div>
    );
  }

  const [noteTags, workspaceTags] = await Promise.all([
    listNoteTags(note.id),
    listWorkspaceTags(),
  ]);
  const initialDocument = await refreshMentionStatus(workspaceId, note.document);

  return (
    <>
      <NoteToolbar noteId={note.id} initialTitle={note.title} updatedAt={note.updatedAt} />
      <div className="mt-10 flex flex-col gap-4">
        <NoteTitleInput noteId={note.id} initialTitle={note.title} />
        <TagsBar noteId={note.id} initialTags={noteTags} workspaceTags={workspaceTags} />
        <NoteEditor
          key={note.id}
          noteId={note.id}
          initialDocument={initialDocument}
          workspaceScope={workspaceScope}
        />
      </div>
    </>
  );
}
