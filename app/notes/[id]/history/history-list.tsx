'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { restoreNoteRevision } from '@/lib/actions/notes';
import type { NoteRevisionSummary } from '@/lib/db/queries/notes';

export function HistoryList({
  noteId,
  revisions,
}: {
  noteId: string;
  revisions: NoteRevisionSummary[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [restoredId, setRestoredId] = useState<string | null>(null);

  if (revisions.length === 0) {
    return (
      <div className="rounded-[12px] border border-dashed border-white/[0.10] bg-white/[0.01] px-4 py-10 text-center text-[12.5px] text-ink-300">
        Noch keine Revisions — die erste Snapshot wird beim nächsten Save erzeugt.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {revisions.map((r) => {
        const d = new Date(r.createdAt);
        return (
          <div
            key={r.id}
            className="flex items-center gap-3 rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-4 py-3"
          >
            <div className="flex flex-col">
              <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
                {d.toLocaleString('de-DE', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span className="text-[13.5px] font-medium text-ink-50">
                {r.title}
              </span>
              {r.createdByName && (
                <span className="font-mono text-[10px] text-ink-300">
                  von {r.createdByName}
                </span>
              )}
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              {restoredId === r.id ? (
                <span className="rounded-full bg-[#5ee08a]/[0.12] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.3px] text-[#5ee08a]">
                  ✓ Wiederhergestellt
                </span>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm('Diese Version wiederherstellen? Aktueller Stand wird als Snapshot gesichert.')) return;
                    start(async () => {
                      const res = await restoreNoteRevision(noteId, r.id);
                      if (res.ok) {
                        setRestoredId(r.id);
                        router.refresh();
                      }
                    });
                  }}
                  className="rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1 text-[11.5px] text-ink-100 hover:bg-white/[0.06] hover:text-ink-50 disabled:opacity-50"
                >
                  Wiederherstellen
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
