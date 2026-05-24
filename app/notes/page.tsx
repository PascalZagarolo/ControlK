import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { listNotesForOverview } from '@/lib/db/queries/notes';
import { NotesOverview } from './notes-overview';
import { NewNoteButton } from './new-note-button';

export const dynamic = 'force-dynamic';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ n?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/notes');
  const ws = await requireCurrentWorkspace();
  const items = await listNotesForOverview(ws.id);
  const sp = await searchParams;
  const selectedId = sp.n ?? null;

  if (items.length === 0) {
    return <EmptyWorkspace />;
  }

  return <NotesOverview items={items} selectedId={selectedId} />;
}

// Zero-notes state. One sentence, one button — no tutorial, no templates
// gallery, no explanatory copy about "how notes work". The product
// explains itself through use.
function EmptyWorkspace() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-160px)] w-full max-w-[1200px] flex-col items-center justify-center gap-6 px-4 pt-28 text-center md:px-6">
      <p className="text-[22px] font-medium leading-tight tracking-[-0.015em] text-[#FAFAFA]">
        Noch keine Notizen.
      </p>
      <NewNoteButton variant="primary" label="+ Erste Notiz schreiben" />
    </div>
  );
}
