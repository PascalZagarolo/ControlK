import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { getNote } from '@/lib/db/queries/notes';
import { listNoteTags, listWorkspaceTags } from '@/lib/actions/note-tags';
import { refreshMentionStatus } from '@/lib/notes/refresh-mention-status';
import { NoteTitleInput } from '@/components/notes/note-title-input';
import { NoteEditor } from '@/components/notes/note-editor';
import { TagsBar } from '@/components/notes/tags-bar';
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

  // Optimistic creation navigates here before the background insert commits.
  // Briefly retry on a miss so the freshly-minted note isn't a false 404;
  // a genuinely missing id just pays this small penalty once.
  let note = await getNote(ws.id, user.id, id);
  for (let i = 0; i < 3 && !note; i++) {
    await new Promise((r) => setTimeout(r, 200));
    note = await getNote(ws.id, user.id, id);
  }
  if (!note) notFound();

  const [noteTags, workspaceTags] = await Promise.all([
    listNoteTags(note.id),
    listWorkspaceTags(),
  ]);

  const aiEnabled = !!(process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY);

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-32 pt-28 md:px-6">
      <AIPanel enabled={aiEnabled} />

      <NoteToolbar noteId={note.id} initialTitle={note.title} updatedAt={note.updatedAt} />

      {/* Editing surface — flat on the canvas, no chrome competing with text. */}
      <div className="mt-10 flex flex-col gap-4">
        <NoteTitleInput noteId={note.id} initialTitle={note.title} />
        <TagsBar
          noteId={note.id}
          initialTags={noteTags}
          workspaceTags={workspaceTags}
        />
        <NoteEditor
          key={note.id}
          noteId={note.id}
          initialDocument={await refreshMentionStatus(ws.id, note.document)}
          workspaceScope={(ws as any).scope === 'private' ? 'private' : 'business'}
        />
      </div>
    </div>
  );
}
