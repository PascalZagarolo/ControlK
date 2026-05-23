'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/lib/stores/ui-store';
import type { SearchHit } from '@/lib/types';

const KIND_LABEL: Record<SearchHit['kind'], string> = {
  channel: 'Channels',
  customer: 'Kunden',
  contract: 'Verträge',
  vehicle: 'Flotte',
  person: 'Personen',
  action: 'Aktionen',
  thread: 'Threads',
};

const KIND_ORDER: SearchHit['kind'][] = [
  'channel',
  'customer',
  'contract',
  'vehicle',
  'person',
  'thread',
  'action',
];

const KIND_GLYPH: Record<SearchHit['kind'], string> = {
  channel: '#',
  customer: '◉',
  contract: '§',
  vehicle: '⊞',
  person: '@',
  action: '→',
  thread: '↳',
};

function rankSearch(query: string, hits: SearchHit[]): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return hits.filter((h) => h.kind === 'action').slice(0, 6);
  const scored = hits
    .map((h) => {
      const title = h.title.toLowerCase();
      const sub = (h.subtitle ?? '').toLowerCase();
      let score = 0;
      if (title === q) score += 100;
      if (title.startsWith(q)) score += 50;
      if (title.includes(q)) score += 25;
      if (sub.includes(q)) score += 8;
      for (const tok of q.split(/\s+/)) {
        if (title.includes(tok)) score += 5;
        if (sub.includes(tok)) score += 2;
      }
      return { hit: h, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);
  return scored.map((s) => s.hit);
}

export function CmdK() {
  const open = useUIStore((s) => s.cmdKOpen);
  const setOpen = useUIStore((s) => s.setCmdKOpen);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [allHits, setAllHits] = useState<SearchHit[]>([]);
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();

  // Fetch index once per open
  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/search', { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled) {
          setAllHits(Array.isArray(data.hits) ? data.hits : []);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, loaded]);

  const filtered = useMemo(() => rankSearch(query, allHits), [query, allHits]);

  const grouped = useMemo(() => {
    const map = new Map<SearchHit['kind'], SearchHit[]>();
    for (const h of filtered) {
      const arr = map.get(h.kind) ?? [];
      arr.push(h);
      map.set(h.kind, arr);
    }
    return KIND_ORDER.map((k) => ({ kind: k, items: map.get(k) ?? [] })).filter(
      (g) => g.items.length > 0
    );
  }, [filtered]);

  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
      return;
    }
    const id = setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(id);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(flat.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        const picked = flat[activeIndex];
        if (picked) {
          e.preventDefault();
          setOpen(false);
          router.push(picked.url);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, flat, activeIndex, router, setOpen]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Suche"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

      <div className="relative w-[min(680px,calc(100vw-32px))] overflow-hidden rounded-[18px] border border-white/[0.08] bg-[rgba(14,15,18,0.96)] shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
          <span className="font-mono text-[11px] uppercase tracking-[0.3px] text-ink-300">⌘K</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={loaded ? 'Suche Channels, Kunden, Verträge, Fahrzeuge …' : 'Lade Index …'}
            className="flex-1 bg-transparent text-[15px] leading-none text-ink-50 outline-none placeholder:text-ink-300"
            autoFocus
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300 transition-colors hover:bg-white/[0.06] hover:text-ink-50"
          >
            Esc
          </button>
        </div>

        {!loaded ? (
          <div className="px-5 py-12 text-center text-[13px] text-ink-300">Lade …</div>
        ) : flat.length === 0 ? (
          <div className="px-5 py-12 text-center text-[13px] text-ink-300">
            {query.trim() ? 'Keine Treffer.' : 'Tippe einen Begriff — oder springe direkt …'}
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto py-2">
            {grouped.map((g) => (
              <div key={g.kind} className="py-1.5">
                <div className="px-5 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
                  {KIND_LABEL[g.kind]}
                </div>
                <div className="flex flex-col">
                  {g.items.map((h) => {
                    const idx = flat.indexOf(h);
                    const isActive = idx === activeIndex;
                    return (
                      <button
                        type="button"
                        key={h.id}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => {
                          setOpen(false);
                          router.push(h.url);
                        }}
                        className={`mx-2 flex items-center gap-3 rounded-[8px] px-3 py-2 text-left transition-colors duration-100 ${
                          isActive ? 'bg-white/[0.07]' : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] bg-white/[0.05] font-mono text-[12px] text-ink-200">
                          {KIND_GLYPH[h.kind]}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block truncate text-[13.5px] leading-tight ${
                              isActive ? 'text-ink-50' : 'text-ink-200'
                            }`}
                          >
                            {h.title}
                          </span>
                          {h.subtitle && (
                            <span className="mt-0.5 block truncate text-[11.5px] leading-tight text-ink-300">
                              {h.subtitle}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
                          {isActive ? '↵' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 border-t border-white/[0.06] px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
          <span className="inline-flex items-center gap-1">↑↓ Navigieren</span>
          <span className="inline-flex items-center gap-1">↵ Öffnen</span>
          <span className="ml-auto">Esc Schließen</span>
        </div>
      </div>
    </div>
  );
}
