'use client';

/**
 * "Als Nächstes" rail panel — the next handful of upcoming events as a tight
 * list, so the most pressing items are always visible without hunting the
 * grid. Pure client derivation from the events already loaded.
 */
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { KIND_META } from './event-color';
import { gridStagger, chipVariants } from './_motion';
import type { CalendarEvent } from '@/lib/types';

export function UpNextPanel({
  events,
  onOpen,
}: {
  events: CalendarEvent[];
  onOpen: (id: string) => void;
}) {
  const upcoming = useMemo(() => {
    const now = Date.now();
    return events
      .filter((e) => new Date(e.endsAt).getTime() >= now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .slice(0, 5);
  }, [events]);

  return (
    <section className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] shadow-panel">
      <header className="border-b border-white/[0.06] px-4 py-3">
        <h3 className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-200">
          Als Nächstes
        </h3>
      </header>
      {upcoming.length === 0 ? (
        <p className="px-4 py-5 text-[12.5px] text-ink-300">Keine kommenden Termine.</p>
      ) : (
        <motion.ul variants={gridStagger} initial="hidden" animate="show" className="flex flex-col">
          {upcoming.map((e) => {
            const meta = KIND_META[e.kind];
            const s = new Date(e.startsAt);
            return (
              <motion.li key={e.id} variants={chipVariants}>
                <button
                  type="button"
                  onClick={() => onOpen(e.id)}
                  className="group flex w-full items-center gap-3 border-b border-white/[0.04] px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-white/[0.02]"
                >
                  <span
                    aria-hidden
                    className="h-7 w-1 shrink-0 rounded-full"
                    style={{ background: meta.color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-ink-50">{e.title}</span>
                    <span className="block truncate text-[11px] text-ink-300">
                      {relDay(s)} · {s.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      {e.location ? ` · ${e.location}` : ''}
                    </span>
                  </span>
                </button>
              </motion.li>
            );
          })}
        </motion.ul>
      )}
    </section>
  );
}

function relDay(d: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(d).setHours(0, 0, 0, 0) - today.getTime()) / 86_400_000);
  if (days === 0) return 'Heute';
  if (days === 1) return 'Morgen';
  if (days < 7) return d.toLocaleDateString('de-DE', { weekday: 'long' });
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
}
