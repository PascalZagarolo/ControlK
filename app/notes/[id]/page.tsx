import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { getNote, listNotesTree } from '@/lib/db/queries/notes';
import { refreshMentionStatus } from '@/lib/notes/refresh-mention-status';
import { NotesSidebar } from '@/components/notes/notes-sidebar';
import { NoteTitleInput } from '@/components/notes/note-title-input';
import { NoteEditor } from '@/components/notes/note-editor';
import { NoteToolbar } from './note-toolbar';
import { AIPanel } from '@/components/notes/ai-panel';

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

  const aiEnabled = !!(process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] gap-8 px-4 pb-32 pt-28 md:px-6 lg:flex-row">
      <AIPanel enabled={aiEnabled} />
      <NotesSidebar items={items} />
      <main className="flex min-w-0 flex-1 flex-col gap-6">
        <NoteToolbar
          noteId={note.id}
          scope={note.scope}
          shareToken={note.shareToken}
          updatedAt={note.updatedAt}
          currentUserId={user.id}
        />
        <NoteTitleInput
          noteId={note.id}
          initialTitle={note.title}
          initialIcon={note.icon}
        />
        <NoteEditor
          noteId={note.id}
          initialDocument={await refreshMentionStatus(ws.id, note.document)}
          workspaceScope={(ws as any).scope === 'private' ? 'private' : 'business'}
        />
      </main>
    </div>
  );
}
