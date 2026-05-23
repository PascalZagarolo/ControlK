'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createNote } from '@/lib/actions/notes';

export function NotesEmptyState({ hasNotes }: { hasNotes: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const create = (title: string, icon?: string) => {
    start(async () => {
      const res = await createNote({ title, icon });
      if (res.ok) router.push(`/notes/${res.id}`);
    });
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
      <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
        Notizen
      </span>
      <h1 className="text-[28px] font-medium leading-[1.15] tracking-[-0.3px] text-ink-50">
        {hasNotes ? 'Wähle eine Notiz links.' : 'Leg deine erste Notiz an.'}
      </h1>
      <p className="max-w-md text-[14px] leading-[1.55] text-ink-300">
        Notizen funktionieren wie in Notion — Slash-Commands für Blocks,
        Markdown-Shortcuts, hierarchische Gliederung. Sie kennen aber deine
        Kunden, Fahrzeuge und Verträge.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => create('Unbenannt')}
          className="rounded-full bg-white px-4 py-2 text-[13px] font-medium leading-none text-black hover:bg-white/90 disabled:opacity-50"
        >
          {pending ? '…' : 'Leere Notiz'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => create('Meeting-Notes', '📝')}
          className="rounded-full border border-white/[0.08] bg-white/[0.02] px-4 py-2 text-[13px] text-ink-100 hover:bg-white/[0.05]"
        >
          📝 Meeting-Notes
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => create('Brainstorm', '💡')}
          className="rounded-full border border-white/[0.08] bg-white/[0.02] px-4 py-2 text-[13px] text-ink-100 hover:bg-white/[0.05]"
        >
          💡 Brainstorm
        </button>
      </div>
    </div>
  );
}
