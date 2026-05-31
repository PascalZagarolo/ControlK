'use client';

/**
 * Full-text note search box for the notes overview. Debounced calls to
 * searchNotesContent (Postgres FTS over title + content); results drop down
 * with a highlighted snippet and link straight into the editor.
 */
import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { searchNotesContent } from '@/lib/actions/notes';
import type { NoteSearchHit } from '@/lib/db/queries/notes';

export function NoteSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NoteSearchHit[] | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);

  // Debounced search.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }
    const id = setTimeout(() => {
      start(async () => {
        const hits = await searchNotesContent(q);
        setResults(hits);
        setOpen(true);
      });
    }, 250);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={wrapRef} className="relative w-[min(320px,60vw)]">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results && setOpen(true)}
        placeholder="Notizen durchsuchen …"
        className="w-full rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-[13px] text-ink-50 outline-none placeholder:text-ink-300 focus:border-white/[0.18]"
      />
      {open && query.trim() && (
        <div className="absolute right-0 z-50 mt-2 w-[min(440px,80vw)] overflow-hidden rounded-[12px] border border-white/[0.08] bg-[rgba(14,15,18,0.97)] shadow-[0_16px_48px_rgba(0,0,0,.55)] backdrop-blur-xl">
          {results === null || pending ? (
            <p className="px-4 py-3 text-[12.5px] text-ink-300">Suche …</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-[12.5px] text-ink-300">Keine Treffer.</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto py-1">
              {results.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/notes/${r.id}`}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-2.5 px-4 py-2 transition-colors hover:bg-white/[0.04]"
                  >
                    <span className="text-[14px] leading-tight">{r.icon ?? '📄'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink-50">{r.title || 'Unbenannt'}</span>
                      {r.snippet && (
                        <span className="mt-0.5 block truncate text-[11.5px] text-ink-300">
                          {renderSnippet(r.snippet)}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// The FTS snippet wraps matches in « … » — render those bolded.
function renderSnippet(snippet: string) {
  const parts = snippet.split(/(«[^»]*»)/g);
  return parts.map((p, i) =>
    p.startsWith('«') && p.endsWith('»') ? (
      <span key={i} className="text-ink-100">
        {p.slice(1, -1)}
      </span>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}
