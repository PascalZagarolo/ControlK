'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createNote, createNoteFromTemplate } from '@/lib/actions/notes';

type Template = {
  key: string;
  title: string;
  icon: string;
  description: string;
};

export function NotesEmptyState({
  hasNotes,
  templates,
}: {
  hasNotes: boolean;
  templates: Template[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const createEmpty = (title: string, icon?: string) => {
    start(async () => {
      const res = await createNote({ title, icon });
      if (res.ok) router.push(`/notes/${res.id}`);
    });
  };

  const createFromTemplate = (key: string) => {
    start(async () => {
      const res = await createNoteFromTemplate({ templateKey: key });
      if (res.ok) router.push(`/notes/${res.id}`);
    });
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 py-16 text-center">
      <div className="flex flex-col items-center gap-3">
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
        <button
          type="button"
          disabled={pending}
          onClick={() => createEmpty('Unbenannt')}
          className="mt-2 rounded-full bg-white px-4 py-2 text-[13px] font-medium leading-none text-black hover:bg-white/90 disabled:opacity-50"
        >
          {pending ? '…' : 'Leere Notiz'}
        </button>
      </div>

      {templates.length > 0 && (
        <div className="flex w-full max-w-[640px] flex-col gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            Templates · {templates.length}
          </span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {templates.map((t) => (
              <button
                key={t.key}
                type="button"
                disabled={pending}
                onClick={() => createFromTemplate(t.key)}
                className="flex flex-col gap-1 rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left transition-colors hover:border-white/[0.16] hover:bg-white/[0.04] disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[18px]">{t.icon}</span>
                  <span className="text-[13.5px] font-medium text-ink-50">{t.title}</span>
                </div>
                <p className="text-[11.5px] leading-[1.45] text-ink-300">{t.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
