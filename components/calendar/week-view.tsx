'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { KIND_META } from './event-color';
import { rescheduleEvent } from '@/lib/actions/calendar';
import type { CalendarEvent } from '@/lib/types';

const DOW = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const HOUR_H = 28;
const START_H = 6;
const END_H = 22;

type CreateDrag = {
  dow: number;
  startHour: number; // anchor (rounded to 0.5)
  currentHour: number; // current pointer position (rounded to 0.5)
};

export function WeekView({
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
  const router = useRouter();
  const [, start] = useTransition();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [hoverSlot, setHoverSlot] = useState<{ dow: number; hour: number } | null>(null);
  const [createDrag, setCreateDrag] = useState<CreateDrag | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Drag-to-create handlers
  const beginCreate = (dow: number, hour: number) => {
    if (!onCreateAt || draggedId) return;
    setCreateDrag({ dow, startHour: hour, currentHour: hour + 1 });
  };

  // Compute hour fraction from mouse position
  const hourFromEvent = (e: React.MouseEvent | MouseEvent, dowIdx: number): number => {
    if (!containerRef.current) return START_H;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const y = (e as MouseEvent).clientY - rect.top;
    const totalH = (END_H - START_H) * HOUR_H;
    const ratio = Math.max(0, Math.min(1, y / totalH));
    const hour = START_H + ratio * (END_H - START_H);
    // Snap to 0.5-hour
    return Math.round(hour * 2) / 2;
  };

  useEffect(() => {
    if (!createDrag) return;
    const onMove = (e: MouseEvent) => {
      // Detect dow from x-position
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      // x: subtract 48px (hour-label column)
      const x = e.clientX - rect.left - 48;
      const colW = (rect.width - 48) / 7;
      const dow = Math.max(0, Math.min(6, Math.floor(x / colW)));
      const hr = hourFromEvent(e, dow);
      setCreateDrag((prev) => (prev ? { ...prev, dow, currentHour: hr } : null));
    };
    const onUp = () => {
      setCreateDrag((cur) => {
        if (cur && onCreateAt) {
          const lo = Math.min(cur.startHour, cur.currentHour);
          const hi = Math.max(cur.startHour, cur.currentHour);
          const minutes = Math.max(15, (hi - lo) * 60);
          const startTs = new Date(weekStart.getTime() + cur.dow * 86_400_000);
          const hours = Math.floor(lo);
          const mins = Math.round((lo - hours) * 60);
          startTs.setHours(hours, mins, 0, 0);
          onCreateAt(startTs.toISOString(), Math.round(minutes));
        }
        return null;
      });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createDrag?.dow, createDrag?.startHour, onCreateAt, weekStart]);

  const hours = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);

  return (
    <div className="overflow-x-auto rounded-[12px] border border-white/[0.06] bg-white/[0.02]">
      <div className="grid" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
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

        {hours.map((h) => (
          <div key={`row-${h}`} className="contents">
            <div
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
                  onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    if ((e.target as HTMLElement).closest('[data-event-card]')) return;
                    beginCreate(dowIdx, h);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!slotHover) setHoverSlot({ dow: dowIdx, hour: h });
                  }}
                  onDragLeave={() => slotHover && setHoverSlot(null)}
                  onDrop={() => handleDrop(dowIdx, h)}
                  className={`relative cursor-cell border-b border-l border-white/[0.04] transition-colors hover:bg-[#5eb6ff]/[0.04] ${
                    slotHover ? 'bg-[#5eb6ff]/[0.06]' : ''
                  }`}
                  style={{ height: HOUR_H }}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div
        ref={containerRef}
        className="pointer-events-none relative"
        style={{ marginTop: -(END_H - START_H) * HOUR_H }}
      >
        <div className="grid" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
          <div></div>
          {days.map((_, dowIdx) => (
            <div
              key={dowIdx}
              className="pointer-events-none relative"
              style={{ height: (END_H - START_H) * HOUR_H }}
            >
              {/* Create-drag highlight */}
              {createDrag && createDrag.dow === dowIdx && (
                <div
                  className="pointer-events-none absolute left-1 right-1 z-10 rounded-[4px] border-2 border-dashed border-[#5eb6ff] bg-[#5eb6ff]/[0.12]"
                  style={{
                    top:
                      (Math.min(createDrag.startHour, createDrag.currentHour) - START_H) * HOUR_H,
                    height:
                      (Math.abs(createDrag.currentHour - createDrag.startHour) || 1) * HOUR_H,
                  }}
                >
                  <span className="absolute -top-5 left-0 rounded-[3px] bg-[#5eb6ff] px-1 py-0.5 font-mono text-[9px] uppercase tracking-[0.3px] text-black">
                    Neuer Termin
                  </span>
                </div>
              )}

              {(eventsByDay.get(dowIdx) ?? []).map((e) => {
                const startD = new Date(e.startsAt);
                const end = new Date(e.endsAt);
                const startHour = startD.getHours() + startD.getMinutes() / 60;
                const endHour = end.getHours() + end.getMinutes() / 60;
                if (endHour <= START_H || startHour >= END_H) return null;
                const top = (Math.max(START_H, startHour) - START_H) * HOUR_H;
                const height = (Math.min(END_H, endHour) - Math.max(START_H, startHour)) * HOUR_H;
                const meta = KIND_META[e.kind];
                return (
                  <button
                    key={e.id}
                    type="button"
                    data-event-card
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onOpen(e.id);
                    }}
                    onMouseDown={(ev) => ev.stopPropagation()}
                    draggable
                    onDragStart={() => setDraggedId(e.id)}
                    onDragEnd={() => setDraggedId(null)}
                    className="pointer-events-auto absolute left-1 right-1 z-20 flex flex-col items-start overflow-hidden rounded-[4px] px-1.5 py-1 text-left text-[10.5px] leading-tight transition-all hover:brightness-125"
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
                    <span
                      className="font-mono text-[9px] uppercase tracking-[0.3px]"
                      style={{ color: meta.color }}
                    >
                      {startD.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
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
