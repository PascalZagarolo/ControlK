import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { getNote, listNoteRevisions } from '@/lib/db/queries/notes';
import { HistoryList } from './history-list';

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/sign-in?from=/notes/${id}/history`);
  const ws = await requireCurrentWorkspace();
  const note = await getNote(ws.id, id);
  if (!note) notFound();
  const revisions = await listNoteRevisions(ws.id, id);

  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6 px-4 pb-32 pt-28 md:px-6">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
        <Link href={`/notes/${id}`} className="hover:text-ink-50">
          ← {note.title}
        </Link>
        <span className="opacity-50">·</span>
        <span>Historie</span>
      </div>
      <header>
        <h1 className="text-[28px] font-medium leading-[1.15] tracking-[-0.3px] text-ink-50">
          Versionsverlauf
        </h1>
        <p className="mt-2 text-[14px] leading-[1.55] text-ink-200">
          Snapshots werden alle 5 Minuten automatisch erstellt. Du kannst jede
          Version wieder herstellen — der aktuelle Stand wird vor dem Restore
          ebenfalls als Snapshot gesichert.
        </p>
      </header>

      <HistoryList noteId={id} revisions={revisions} />
    </div>
  );
}
