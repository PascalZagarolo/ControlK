'use client';

import { useState } from 'react';
import { useUIStore } from '@/lib/stores/ui-store';

const SUGGESTIONS = ['Neuer Vertrag', 'Heutige Termine', 'Kunden', 'Channels'];

export function Hero({ firstName }: { firstName?: string }) {
  const setCmdK = useUIStore((s) => s.setCmdKOpen);
  const [query, setQuery] = useState('');

  return (
    <section className="relative z-10 flex shrink-0 flex-col items-center px-6 pb-12 pt-32">
      <h1 className="max-w-[760px] text-center text-[44px] font-medium leading-[1.1] tracking-[-0.6px] text-ink-50">
        {firstName ? `Willkommen zurück, ${firstName}.` : 'Ein Workspace für alles.'}
      </h1>
      <p className="mt-4 max-w-[560px] text-center text-[16px] leading-[1.55] text-ink-200">
        Channels, Kunden, Verträge und Kalender — in einem Tool, ohne Tab-Wirrwarr.
      </p>

      <button
        type="button"
        onClick={() => setCmdK(true)}
        className="group mt-10 w-full max-w-[720px] cursor-text"
      >
        <div className="relative flex items-center gap-3 rounded-[18px] border border-white/[0.08] bg-[rgba(20,21,23,0.7)] px-5 py-4 shadow-panel backdrop-blur-xl transition-colors duration-200 group-hover:border-white/15 group-hover:bg-[rgba(24,25,28,0.85)]">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-ink-300 transition-colors duration-200 group-hover:text-ink-50"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setCmdK(true)}
            placeholder="Suche Kunden, Verträge, Channels …"
            className="flex-1 bg-transparent text-left text-[18px] leading-none text-ink-50 outline-none placeholder:text-ink-300"
            spellCheck={false}
          />
          <kbd className="shrink-0 rounded-[6px] border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[11px] leading-none text-ink-300">
            ⌘K
          </kbd>
        </div>
      </button>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[12px]">
        <span className="text-ink-300">Beliebt:</span>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setCmdK(true)}
            className="rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1 text-ink-200 transition-colors duration-150 hover:border-white/15 hover:bg-white/[0.05] hover:text-ink-50"
          >
            {s}
          </button>
        ))}
      </div>
    </section>
  );
}
