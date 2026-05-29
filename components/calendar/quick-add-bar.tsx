'use client';

/**
 * Natural-language quick-add. The user types a line like
 * "Übergabe morgen 14 Uhr BMW X5 für Müller"; we parse it (AI, with a
 * deterministic fallback) into a draft and hand it up so the create modal
 * opens pre-filled for confirmation — AI never creates the event directly.
 */
import { useState, useTransition } from 'react';
import { motion } from 'framer-motion';
import { parseQuickEvent, type QuickParsedEvent } from '@/lib/actions/calendar';
import { EASE_SOFT } from './_motion';

export function QuickAddBar({ onDraft }: { onDraft: (draft: QuickParsedEvent) => void }) {
  const [value, setValue] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const text = value.trim();
    if (!text || pending) return;
    setError(null);
    start(async () => {
      const res = await parseQuickEvent(text);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setValue('');
      onDraft(res.draft);
    });
  };

  return (
    <div>
      <div
        className="flex items-center gap-2.5 rounded-[12px] border border-white/[0.07] bg-white/[0.025] px-3.5 py-2.5 shadow-panel transition-colors focus-within:border-[#5E9EFF]/40"
      >
        <motion.span
          aria-hidden
          className="shrink-0 text-[13px]"
          animate={pending ? { rotate: [0, 360] } : { rotate: 0 }}
          transition={pending ? { duration: 1, ease: 'linear', repeat: Infinity } : { duration: EASE_SOFT[0] }}
        >
          ✦
        </motion.span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          disabled={pending}
          placeholder='Termin in Worten — z.B. „Übergabe morgen 14 Uhr BMW X5 für Müller"'
          className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink-50 outline-none placeholder:text-ink-300 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending || !value.trim()}
          className="shrink-0 rounded-full bg-[#5E9EFF] px-3 py-1 text-[12px] font-medium text-black transition-colors hover:bg-[#7CB0FF] disabled:opacity-40"
        >
          {pending ? 'Lese …' : 'Anlegen'}
        </button>
      </div>
      {error && <p className="mt-1.5 px-1 text-[11.5px] text-[#ff8a8a]">{error}</p>}
    </div>
  );
}
