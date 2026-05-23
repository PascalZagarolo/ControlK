'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addCustomerNoteEntry, updateCustomerField } from '@/lib/actions/customers';
import { VoiceCaptureButton } from '@/components/todos/voice-capture-button';

export function CustomerNotesEditor({
  customerId,
  notes,
}: {
  customerId: string;
  notes: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(notes);
  const [pending, start] = useTransition();
  const lastSavedRef = useRef(notes);

  useEffect(() => {
    setDraft(notes);
    lastSavedRef.current = notes;
  }, [notes]);

  const save = () => {
    if (draft === lastSavedRef.current) return;
    start(async () => {
      const res = await updateCustomerField({
        customerId,
        field: 'notes',
        value: draft,
      });
      if (res.ok) lastSavedRef.current = draft;
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          Notizen
        </span>
        <div className="flex items-center gap-2">
          <VoiceCaptureButton
            onTranscript={(text) =>
              setDraft((prev) => (prev ? prev + '\n' : '') + text)
            }
          />
          <button
            type="button"
            onClick={save}
            disabled={pending || draft === lastSavedRef.current}
            className="rounded-[6px] border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-[11px] text-ink-200 transition-colors hover:bg-white/[0.05] disabled:opacity-40"
          >
            {pending ? 'Speichere …' : 'Speichern'}
          </button>
        </div>
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            save();
          }
        }}
        rows={6}
        placeholder="Notizen zum Kunden — Pricing-Verhandlungen, Sonderkonditionen, Verlauf…"
        className="resize-y rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[13px] leading-[1.55] text-ink-50 outline-none focus:border-white/[0.18]"
      />
      <p className="font-mono text-[9.5px] uppercase tracking-[0.3px] text-ink-300">
        Auto-Save beim Blur · ⌘↵ zum sofortigen Speichern · 🎙 für Voice-Note
      </p>
    </div>
  );
}

export function QuickNoteEntry({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [pending, start] = useTransition();
  const submit = () => {
    if (!title.trim()) return;
    start(async () => {
      await addCustomerNoteEntry({ customerId, title: title.trim() });
      setTitle('');
      router.refresh();
    });
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-center gap-2"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Schnelle Notiz hinzufügen …"
        className="min-w-0 flex-1 rounded-[6px] border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[12.5px] text-ink-50 outline-none focus:border-white/[0.18]"
      />
      <VoiceCaptureButton onTranscript={(t) => setTitle(t)} />
      <button
        type="submit"
        disabled={!title.trim() || pending}
        className="rounded-[6px] bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-black disabled:opacity-30"
      >
        +
      </button>
    </form>
  );
}
