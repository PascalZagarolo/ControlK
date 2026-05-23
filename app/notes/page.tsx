import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { listNotesTree } from '@/lib/db/queries/notes';
import { NotesSidebar } from '@/components/notes/notes-sidebar';
import { NotesEmptyState } from './notes-empty-state';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/notes');
  const ws = await requireCurrentWorkspace();
  const items = await listNotesTree(ws.id);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] gap-8 px-4 pb-32 pt-28 md:px-6 lg:flex-row">
      <NotesSidebar items={items} />
      <main className="flex min-w-0 flex-1 flex-col">
        <NotesEmptyState hasNotes={items.length > 0} />
      </main>
    </div>
  );
}
