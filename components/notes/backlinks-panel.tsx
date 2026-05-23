import Link from 'next/link';
import type { NoteBacklink } from '@/lib/db/queries/note-backlinks';

/**
 * Renders the "Mentioned in N Notizen" panel on entity detail pages
 * (customer / contract / vehicle / channel). Server component — pass the
 * pre-fetched backlinks in.
 */
export function BacklinksPanel({
  backlinks,
  emptyLabel = 'Noch keine Erwähnungen in Notizen.',
}: {
  backlinks: NoteBacklink[];
  emptyLabel?: string;
}) {
  if (backlinks.length === 0) {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-300">
          · Erwähnt in Notizen
        </h2>
        <p className="rounded-[10px] border border-dashed border-white/[0.10] bg-white/[0.01] px-3 py-3 text-[12px] text-ink-300">
          {emptyLabel}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-300">
        · Erwähnt in {backlinks.length} {backlinks.length === 1 ? 'Notiz' : 'Notizen'}
      </h2>
      <div className="flex flex-col gap-1.5">
        {backlinks.map((b) => (
          <Link
            key={b.noteId}
            href={`/notes/${b.noteId}`}
            className="group flex items-center gap-2.5 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
          >
            <span className="shrink-0 text-[14px]">
              {b.noteIcon ?? <span className="text-ink-300">·</span>}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium text-ink-50">
                {b.noteTitle}
              </span>
              <span className="mt-0.5 block font-mono text-[10.5px] uppercase tracking-[0.3px] text-ink-300">
                {b.mentionCount}× · zuletzt{' '}
                {new Date(b.noteUpdatedAt).toLocaleDateString('de-DE', {
                  day: '2-digit',
                  month: 'short',
                })}
              </span>
            </span>
            <span className="font-mono text-[11px] text-ink-300 group-hover:text-ink-50">→</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
