'use client';

import { useEffect, useState } from 'react';
import { peekFreshNote, clearFreshNote } from '@/lib/notes/optimistic-notes';
import { listWorkspaceTags, type Tag } from '@/lib/actions/note-tags';
import { NoteToolbar } from './note-toolbar';
import { NoteTitleInput } from '@/components/notes/note-title-input';
import { TagsBar } from '@/components/notes/tags-bar';
import { NoteEditor } from '@/components/notes/note-editor';

type Scope = 'business' | 'private';

/**
 * Decides — on the client, instantly — whether this id is a just-created note.
 * If so, the editor opens immediately with empty defaults (the background
 * insert + the editor's own localStorage/Yjs persistence cover durability).
 * Otherwise it falls through to `children`: the server-streamed existing-note
 * body (proven path, untouched).
 *
 * peek-in-initializer + clear-in-effect keeps this correct under StrictMode's
 * double render, and the flag is forgotten after first mount so a later reload
 * loads the note normally.
 */
export function FreshGate({
  noteId,
  workspaceScope,
  children,
}: {
  noteId: string;
  workspaceScope: Scope;
  children: React.ReactNode;
}) {
  const [fresh] = useState(() => peekFreshNote(noteId));

  useEffect(() => {
    clearFreshNote(noteId);
  }, [noteId]);

  if (fresh) return <FreshNoteBody noteId={noteId} workspaceScope={workspaceScope} />;
  return <>{children}</>;
}

function FreshNoteBody({ noteId, workspaceScope }: { noteId: string; workspaceScope: Scope }) {
  // Tag autocomplete suggestions aren't needed at t=0; load them right after
  // mount so the editor itself never waits on a round trip.
  const [workspaceTags, setWorkspaceTags] = useState<Tag[]>([]);
  const [createdAt] = useState(() => new Date().toISOString());

  useEffect(() => {
    let alive = true;
    listWorkspaceTags()
      .then((t) => alive && setWorkspaceTags(t))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <NoteToolbar noteId={noteId} initialTitle="Unbenannt" updatedAt={createdAt} />
      <div className="mt-10 flex flex-col gap-4">
        <NoteTitleInput noteId={noteId} initialTitle="Unbenannt" />
        <TagsBar noteId={noteId} initialTags={[]} workspaceTags={workspaceTags} />
        <NoteEditor noteId={noteId} initialDocument={[]} workspaceScope={workspaceScope} />
      </div>
    </>
  );
}
