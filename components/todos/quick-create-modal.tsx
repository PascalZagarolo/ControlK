'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createTodoFromSlash } from '@/lib/actions/todos';
import { createTodo } from '@/lib/actions/todos';

/**
 * Lightweight Cmd+T capture. Re-uses the slash-parser semantics
 * (smart date, @mention, priority `!!!`) but skips the channel binding.
 */
export function QuickCreateModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setText('');
    setError(null);
    const id = setTimeout(() => inputRef.current?.focus(), 10);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(id);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    setError(null);
    start(async () => {
      // re-use the slash parser by giving channelId='' through the simpler create path
      const parsed = parseQuickInput(t);
      const res = await createTodo({
        title: parsed.title,
        dueAt: parsed.dueAt ? parsed.dueAt.toISOString() : null,
        priority: parsed.priority,
        visibility: 'private',
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[14vh]">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[min(620px,calc(100vw-32px))] overflow-hidden rounded-[14px] border border-white/[0.08] bg-[rgba(14,15,18,0.97)] shadow-panel backdrop-blur-xl">
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
          <span className="font-mono text-[11px] uppercase tracking-[0.3px] text-ink-300">⌘T</span>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="z.B. Müller Angebot anpassen morgen 14:00 !!"
            className="flex-1 bg-transparent text-[16px] leading-none text-ink-50 outline-none placeholder:text-ink-300"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300 transition-colors hover:bg-white/[0.06] hover:text-ink-50"
          >
            Esc
          </button>
        </div>
        <div className="px-5 py-3">
          {error && (
            <div className="mb-3 rounded-[8px] border border-[#ff8a8a]/30 bg-[#ff8a8a]/10 px-3 py-2 text-[12px] text-[#ffbdbd]">
              {error}
            </div>
          )}
          <div className="font-mono text-[10.5px] uppercase tracking-[0.3px] text-ink-300">
            Tipps: <span className="text-ink-200">morgen 14:00</span> ·{' '}
            <span className="text-ink-200">Freitag</span> ·{' '}
            <span className="text-ink-200">in 3 tagen</span> ·{' '}
            <span className="text-ink-200">!!</span> hoch · <span className="text-ink-200">!!!</span> urgent
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
          <span>↵ Erstellen</span>
          <span>Privat · Snooze + Verknüpfungen im Detail</span>
        </div>
      </div>
    </div>
  );
}

function parseQuickInput(text: string): {
  title: string;
  priority?: 'mittel' | 'hoch' | 'urgent' | 'niedrig';
  dueAt?: Date;
} {
  let working = text;
  let priority: 'mittel' | 'hoch' | 'urgent' | undefined;
  const prio = working.match(/(^|\s)!!!?/);
  if (prio) {
    priority = prio[0].trim() === '!!!' ? 'urgent' : 'hoch';
    working = (working.slice(0, prio.index!) + working.slice(prio.index! + prio[0].length)).trim();
  }
  const dueAt = extractDue(working);
  if (dueAt) {
    working = working
      .replace(/\b(heute|morgen|übermorgen|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b(\s+\d{1,2}[:.]\d{2})?/i, '')
      .replace(/\bin\s+\d+\s+tagen?\b/i, '')
      .replace(/\b\d{4}-\d{2}-\d{2}(\s+\d{1,2}[:.]\d{2})?\b/, '')
      .trim();
  }
  return { title: working, priority, dueAt };
}

function extractDue(text: string): Date | undefined {
  const lower = text.toLowerCase();
  const time = lower.match(/\b(\d{1,2})[:.](\d{2})\b/);
  const hh = time ? parseInt(time[1], 10) : 9;
  const mm = time ? parseInt(time[2], 10) : 0;
  const setT = (d: Date) => {
    d.setHours(hh, mm, 0, 0);
    return d;
  };
  const today = new Date();
  if (/\bheute\b/.test(lower)) return setT(new Date(today));
  if (/\bmorgen\b/.test(lower)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return setT(d);
  }
  const weekdays = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag'];
  for (let i = 0; i < weekdays.length; i++) {
    if (new RegExp(`\\b${weekdays[i]}\\b`).test(lower)) {
      const d = new Date(today);
      const delta = (i - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + delta);
      return setT(d);
    }
  }
  const inDays = lower.match(/\bin\s+(\d+)\s+tagen?\b/);
  if (inDays) {
    const d = new Date(today);
    d.setDate(d.getDate() + parseInt(inDays[1], 10));
    return setT(d);
  }
  return undefined;
}
