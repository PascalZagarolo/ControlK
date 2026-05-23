import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getNoteByShareToken } from '@/lib/db/queries/notes';
import { NoteEditor } from '@/components/notes/note-editor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const note = await getNoteByShareToken(token);
  if (!note) notFound();

  return (
    <div className="relative min-h-screen bg-ink-900">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 pb-32 pt-16 md:px-6">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          <Link href="/" className="hover:text-ink-50">
            uRent
          </Link>
          <span className="opacity-50">·</span>
          <span>Public Note</span>
        </div>
        <div className="flex flex-col gap-3">
          {note.icon && <span className="text-[36px] leading-none">{note.icon}</span>}
          <h1 className="text-[36px] font-medium leading-[1.15] tracking-[-0.4px] text-ink-50">
            {note.title}
          </h1>
        </div>
        <NoteEditor noteId={note.id} initialDocument={note.document} readOnly />
        <footer className="mt-8 border-t border-white/[0.06] pt-4 text-center text-[10.5px] text-ink-300">
          Geteilt via uRent · read-only
        </footer>
      </div>
    </div>
  );
}
