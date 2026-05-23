'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { KIND_META } from './event-color';
import { rescheduleEvent } from '@/lib/actions/calendar';
import type { CalendarEvent } from '@/lib/types';

const DOW = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const HOUR_H = 28; // px per hour
const START_H = 6;
const END_H = 22;

export function WeekView({
  cursor,
  events,
  onOpen,
}: {
  cursor: Date;
  events: CalendarEvent[];
  onOpen: (id: string) => void;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [hoverSlot, setHoverSlot] = useState<{ dow: number; hour: number } | null>(null);

  const weekStart = useMemo(() => {
    const d = new Date(cursor);
    const dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [cursor]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 86_400_000)),
    [weekStart]
  );

  const eventsByDay = useMemo(() => {
    const m = new Map<number, CalendarEvent[]>();
    for (let i = 0; i < 7; i++) m.set(i, []);
    for (const e of events) {
      const start = new Date(e.startsAt);
      const dayIdx = Math.floor((start.getTime() - weekStart.getTime()) / 86_400_000);
      if (dayIdx >= 0 && dayIdx < 7) m.get(dayIdx)!.push(e);
    }
    return m;
  }, [events, weekStart]);

  const todayIso = new Date().toISOString().slice(0, 10);

  const handleDrop = (dow: number, hour: number) => {
    if (!draggedId) return;
    const newStart = new Date(weekStart.getTime() + dow * 86_400_000);
    newStart.setHours(hour, 0, 0, 0);
    start(async () => {
      await rescheduleEvent({ eventId: draggedId, newStartIso: newStart.toISOString() });
      router.refresh();
    });
    setDraggedId(null);
    setHoverSlot(null);
  };

  const hours = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);

  return (
    <div className="overflow-x-auto rounded-[12px] border border-white/[0.06] bg-white/[0.02]">
      <div className="grid" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
        {/* Header row */}
        <div className="border-b border-white/[0.06]"></div>
        {days.map((d, i) => {
          const iso = d.toISOString().slice(0, 10);
          const isToday = iso === todayIso;
          return (
            <div
              key={i}
              className="border-b border-l border-white/[0.06] px-2 py-1.5 text-center font-mono"
            >
              <div
                className={`text-[10px] uppercase tracking-[0.3px] ${
                  isToday ? 'text-[#5eb6ff]' : 'text-ink-300'
                }`}
              >
                {DOW[i]}
              </div>
              <div
                className={`text-[13px] tabular-nums ${
                  isToday ? 'text-[#5eb6ff] font-medium' : 'text-ink-100'
                }`}
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}

        {/* Hour rows */}
        {hours.map((h) => (
          <>
            <div
              key={`label-${h}`}
              className="border-b border-white/[0.04] px-1.5 pt-1 font-mono text-[9px] uppercase tracking-[0.3px] text-ink-300"
              style={{ height: HOUR_H }}
            >
              {String(h).padStart(2, '0')}:00
            </div>
            {days.map((_, dowIdx) => {
              const slotHover = hoverSlot?.dow === dowIdx && hoverSlot?.hour === h;
              return (
                <div
                  key={`slot-${h}-${dowIdx}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!slotHover) setHoverSlot({ dow: dowIdx, hour: h });
                  }}
                  onDragLeave={() => slotHover && setHoverSlot(null)}
                  onDrop={() => handleDrop(dowIdx, h)}
                  className={`relative border-b border-l border-white/[0.04] ${
                    slotHover ? 'bg-[#5eb6ff]/[0.06]' : ''
                  }`}
                  style={{ height: HOUR_H }}
                />
              );
            })}
          </>
        ))}
      </div>

      {/* Event overlays */}
      <div className="relative -mt-[392px]" style={{ marginTop: -(END_H - START_H) * HOUR_H }}>
        <div className="grid" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
          <div></div>
          {days.map((_, dowIdx) => (
            <div key={dowIdx} className="relative" style={{ height: (END_H - START_H) * HOUR_H }}>
              {(eventsByDay.get(dowIdx) ?? []).map((e) => {
                const start = new Date(e.startsAt);
                const end = new Date(e.endsAt);
                const startHour = start.getHours() + start.getMinutes() / 60;
                const endHour = end.getHours() + end.getMinutes() / 60;
                if (endHour <= START_H || startHour >= END_H) return null;
                const top = (Math.max(START_H, startHour) - START_H) * HOUR_H;
                const height = (Math.min(END_H, endHour) - Math.max(START_H, startHour)) * HOUR_H;
                const meta = KIND_META[e.kind];
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onOpen(e.id)}
                    draggable
                    onDragStart={() => setDraggedId(e.id)}
                    onDragEnd={() => setDraggedId(null)}
                    className="absolute left-1 right-1 flex flex-col items-start overflow-hidden rounded-[4px] px-1.5 py-1 text-left text-[10.5px] leading-tight transition-all hover:brightness-125"
                    style={{
                      top,
                      height: Math.max(20, height),
                      background: `${meta.color}28`,
                      boxShadow: `inset 0 0 0 1px ${meta.color}66`,
                      color: '#e6e7ec',
                      opacity: draggedId === e.id ? 0.4 : 1,
                    }}
                    title={`${meta.label} · ${e.title}`}
                  >
                    <span className="font-mono text-[9px] uppercase tracking-[0.3px]" style={{ color: meta.color }}>
                      {start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="truncate">{e.title}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
