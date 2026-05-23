'use client';

import { useMemo } from 'react';
import { KIND_META } from './event-color';
import type { CalendarEvent } from '@/lib/types';

const DOW = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function MonthView({
  cursor,
  events,
  onOpen,
  onCreateAt,
}: {
  cursor: Date;
  events: CalendarEvent[];
  onOpen: (id: string) => void;
  onCreateAt?: (startIso: string, durationMinutes: number) => void;
}) {
  const grid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const firstDow = (first.getDay() + 6) % 7;
    const days: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < firstDow; i++)
      days.push({ date: new Date(year, month, 1 - (firstDow - i)), inMonth: false });
    for (let i = 1; i <= last.getDate(); i++)
      days.push({ date: new Date(year, month, i), inMonth: true });
    const tail = (Math.ceil((firstDow + last.getDate()) / 7) * 7) - days.length;
    for (let i = 1; i <= tail; i++)
      days.push({ date: new Date(year, month + 1, i), inMonth: false });
    return days;
  }, [cursor]);

  const eventsByDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const iso = new Date(e.startsAt).toISOString().slice(0, 10);
      if (!m.has(iso)) m.set(iso, []);
      m.get(iso)!.push(e);
    }
    return m;
  }, [events]);

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.02]">
      <div className="grid grid-cols-7 border-b border-white/[0.06]">
        {DOW.map((d) => (
          <div
            key={d}
            className="px-2 py-1.5 text-center font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((cell, i) => {
          const iso = cell.date.toISOString().slice(0, 10);
          const dayEvents = eventsByDay.get(iso) ?? [];
          const isToday = iso === todayIso;
          const handleCellClick = () => {
            if (!onCreateAt) return;
            const start = new Date(cell.date);
            start.setHours(9, 0, 0, 0);
            onCreateAt(start.toISOString(), 60);
          };
          return (
            <div
              key={i}
              onClick={handleCellClick}
              className={`group/cell relative min-h-[112px] cursor-pointer border-b border-r border-white/[0.04] p-1.5 transition-colors hover:bg-[#5eb6ff]/[0.04] ${
                cell.inMonth ? '' : 'opacity-50'
              }`}
            >
              <div
                className={`mb-1 flex items-center justify-between font-mono text-[11px] tabular-nums ${
                  isToday ? 'text-[#5eb6ff] font-medium' : 'text-ink-300'
                }`}
              >
                <span>{cell.date.getDate()}</span>
                {onCreateAt && (
                  <span className="opacity-0 transition-opacity group-hover/cell:opacity-100">
                    <span className="text-[10px] text-ink-400">+ klicken</span>
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                {dayEvents.slice(0, 3).map((e) => {
                  const meta = KIND_META[e.kind];
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onOpen(e.id);
                      }}
                      title={`${meta.label} · ${e.title}`}
                      className="flex items-center gap-1 rounded-[3px] px-1 py-0.5 text-left text-[10.5px] leading-tight transition-colors hover:bg-white/[0.06]"
                      style={{ background: `${meta.color}1c`, color: '#e6e7ec' }}
                    >
                      <span style={{ color: meta.color }}>{meta.icon}</span>
                      <span className="truncate">{e.title}</span>
                    </button>
                  );
                })}
                {dayEvents.length > 3 && (
                  <span className="px-1 font-mono text-[9.5px] text-ink-300">
                    +{dayEvents.length - 3} mehr
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
