import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { getNote, listNotesTree } from '@/lib/db/queries/notes';
import { NotesSidebar } from '@/components/notes/notes-sidebar';
import { NoteTitleInput } from '@/components/notes/note-title-input';
import { NoteEditor } from '@/components/notes/note-editor';
import { NoteToolbar } from './note-toolbar';

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/sign-in?from=/notes/${id}`);
  const ws = await requireCurrentWorkspace();

  const [note, items] = await Promise.all([getNote(ws.id, id), listNotesTree(ws.id)]);
  if (!note) notFound();

  return (
    <div className="mx-auto flex w-full max-w-[1200px] gap-8 px-4 pb-32 pt-28 md:px-6 lg:flex-row">
      <NotesSidebar items={items} />
      <main className="flex min-w-0 flex-1 flex-col gap-6">
        <NoteToolbar
          noteId={note.id}
          scope={note.scope}
          shareToken={note.shareToken}
          updatedAt={note.updatedAt}
        />
        <NoteTitleInput
          noteId={note.id}
          initialTitle={note.title}
          initialIcon={note.icon}
        />
        <NoteEditor
          noteId={note.id}
          initialDocument={note.document}
          workspaceScope={(ws as any).scope === 'private' ? 'private' : 'business'}
        />
      </main>
    </div>
  );
}
