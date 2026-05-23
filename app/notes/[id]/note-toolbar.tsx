'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { archiveNote, duplicateNote, setNoteScope } from '@/lib/actions/notes';
import type { NoteScope } from '@/lib/types';

export function NoteToolbar({
  noteId,
  scope,
  shareToken,
  updatedAt,
}: {
  noteId: string;
  scope: NoteScope;
  shareToken?: string;
  updatedAt: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  const publicUrl =
    typeof window !== 'undefined' && shareToken
      ? `${window.location.origin}/share/notes/${shareToken}`
      : '';

  const toggleScope = (next: NoteScope) => {
    start(async () => {
      await setNoteScope(noteId, next);
      router.refresh();
    });
  };

  const doDuplicate = () => {
    start(async () => {
      const res = await duplicateNote(noteId);
      if (res.ok) router.push(`/notes/${res.id}`);
    });
  };

  const doArchive = () => {
    if (!confirm('Notiz archivieren?')) return;
    start(async () => {
      await archiveNote(noteId);
      router.push('/notes');
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] pb-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
        Notiz · zuletzt {new Date(updatedAt).toLocaleString('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        <div className="flex items-center gap-0.5 rounded-full border border-white/[0.06] bg-white/[0.02] p-0.5">
          {(['private', 'workspace', 'public'] as NoteScope[]).map((sc) => {
            const isActive = scope === sc;
            const label = sc === 'private' ? 'Privat' : sc === 'workspace' ? 'Workspace' : 'Public';
            return (
              <button
                key={sc}
                type="button"
                onClick={() => toggleScope(sc)}
                disabled={pending}
                className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.3px] transition-colors ${
                  isActive
                    ? sc === 'public'
                      ? 'bg-[#5ee08a]/[0.16] text-[#5ee08a]'
                      : 'bg-white/[0.08] text-ink-50'
                    : 'text-ink-300 hover:text-ink-100'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {scope === 'public' && shareToken && (
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(publicUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {}
            }}
            className="rounded-full border border-[#5ee08a]/30 bg-[#5ee08a]/[0.06] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.3px] text-[#5ee08a] transition-colors hover:bg-[#5ee08a]/[0.10]"
            title={publicUrl}
          >
            {copied ? '✓ Kopiert' : '🔗 Link kopieren'}
          </button>
        )}
        <button
          type="button"
          onClick={doDuplicate}
          disabled={pending}
          className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11px] text-ink-200 hover:bg-white/[0.05] hover:text-ink-50"
        >
          Duplizieren
        </button>
        <button
          type="button"
          onClick={doArchive}
          disabled={pending}
          className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11px] text-ink-300 hover:bg-[#ff8a8a]/[0.10] hover:text-[#ff8a8a]"
        >
          Archivieren
        </button>
      </div>
    </div>
  );
}
