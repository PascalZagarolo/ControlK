'use client';

import { useMemo } from 'react';
import { KIND_META } from './event-color';
import type { CalendarEvent } from '@/lib/types';

function dayBucket(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function AgendaView({
  events,
  onOpen,
}: {
  events: CalendarEvent[];
  onOpen: (id: string) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const day = new Date(e.startsAt).toISOString().slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(e);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, evts]) => ({
        day,
        events: evts.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
      }));
  }, [events]);

  if (groups.length === 0) {
    return (
      <div className="rounded-[12px] border border-dashed border-white/[0.10] bg-white/[0.01] py-14 text-center text-[14px] text-ink-300">
        Keine Termine im aktuellen Zeitraum.
      </div>
    );
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => {
        const isToday = g.day === todayIso;
        return (
          <section key={g.day}>
            <h3
              className={`mb-2 font-mono text-[10.5px] uppercase tracking-[0.4px] ${
                isToday ? 'text-[#5eb6ff]' : 'text-ink-300'
              }`}
            >
              {dayBucket(g.day)}
              <span className="ml-2 text-ink-300/70">· {g.events.length}</span>
            </h3>
            <div className="flex flex-col gap-1.5">
              {g.events.map((e) => {
                const meta = KIND_META[e.kind];
                const s = new Date(e.startsAt);
                const en = new Date(e.endsAt);
                const checklistDone = e.checklist.filter((c) => c.done).length;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onOpen(e.id)}
                    className="group flex items-center gap-3 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
                  >
                    <span
                      className="font-mono text-[11px] uppercase tracking-[0.3px]"
                      style={{ color: meta.color }}
                    >
                      {s.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span
                      className="inline-flex h-5 items-center gap-1 rounded-full px-2 font-mono text-[10px] uppercase tracking-[0.3px]"
                      style={{ background: `${meta.color}1f`, color: meta.color }}
                    >
                      {meta.label}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink-50">
                        {e.title}
                      </span>
                      {(e.linkedCustomerName || e.linkedVehiclePlate || e.location) && (
                        <span className="mt-0.5 block truncate text-[11.5px] text-ink-300">
                          {[
                            e.linkedCustomerName && `◉ ${e.linkedCustomerName}`,
                            e.linkedVehiclePlate && `⊞ ${e.linkedVehiclePlate}`,
                            e.location && `⌖ ${e.location}`,
                          ]
                            .filter(Boolean)
                            .join('  ·  ')}
                        </span>
                      )}
                    </span>
                    {e.checklist.length > 0 && (
                      <span
                        className={`font-mono text-[10px] ${
                          checklistDone === e.checklist.length ? 'text-[#5ee08a]' : 'text-ink-300'
                        }`}
                      >
                        ✓ {checklistDone}/{e.checklist.length}
                      </span>
                    )}
                    <span className="font-mono text-[10px] text-ink-300">
                      {Math.round((en.getTime() - s.getTime()) / 60_000)} min
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
