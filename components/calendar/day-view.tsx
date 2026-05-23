'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { KIND_META } from './event-color';
import type { CalendarEvent } from '@/lib/types';

const HOUR_H = 48;
const START_H = 6;
const END_H = 22;

type CreateDrag = { startHour: number; currentHour: number };

export function DayView({
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
  const [createDrag, setCreateDrag] = useState<CreateDrag | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const dayStart = useMemo(() => {
    const d = new Date(cursor);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [cursor]);

  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  const dayEvents = useMemo(
    () =>
      events
        .filter((e) => {
          const s = new Date(e.startsAt);
          const en = new Date(e.endsAt);
          return en > dayStart && s < dayEnd;
        })
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [events, dayStart, dayEnd]
  );

  const hourFromY = (clientY: number): number => {
    if (!containerRef.current) return START_H;
    const rect = containerRef.current.getBoundingClientRect();
    const y = clientY - rect.top;
    const totalH = (END_H - START_H) * HOUR_H;
    const ratio = Math.max(0, Math.min(1, y / totalH));
    const hour = START_H + ratio * (END_H - START_H);
    return Math.round(hour * 4) / 4; // snap to 15-min
  };

  useEffect(() => {
    if (!createDrag) return;
    const onMove = (e: MouseEvent) => {
      const hr = hourFromY(e.clientY);
      setCreateDrag((prev) => (prev ? { ...prev, currentHour: hr } : null));
    };
    const onUp = () => {
      setCreateDrag((cur) => {
        if (cur && onCreateAt) {
          const lo = Math.min(cur.startHour, cur.currentHour);
          const hi = Math.max(cur.startHour, cur.currentHour);
          const minutes = Math.max(15, (hi - lo) * 60);
          const startTs = new Date(dayStart);
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
  }, [createDrag?.startHour, onCreateAt, dayStart]);

  const hours = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);
  const totalH = (END_H - START_H) * HOUR_H;
  const now = new Date();
  const nowIsThisDay = now >= dayStart && now < dayEnd;
  const nowOffset = nowIsThisDay
    ? (now.getHours() + now.getMinutes() / 60 - START_H) * HOUR_H
    : null;

  return (
    <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.02]">
      <div className="border-b border-white/[0.06] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.3px] text-ink-300">
        {dayStart.toLocaleDateString('de-DE', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
        })}
      </div>
      <div
        ref={containerRef}
        className="relative cursor-cell"
        style={{ height: totalH }}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          if ((e.target as HTMLElement).closest('[data-event-card]')) return;
          if (!onCreateAt) return;
          const hr = hourFromY(e.clientY);
          setCreateDrag({ startHour: hr, currentHour: hr + 1 });
        }}
      >
        {hours.map((h, i) => (
          <div
            key={h}
            className="absolute inset-x-0 border-b border-white/[0.04] pl-2 pr-3"
            style={{ top: i * HOUR_H, height: HOUR_H }}
          >
            <span className="pointer-events-none font-mono text-[9.5px] uppercase tracking-[0.3px] text-ink-300">
              {String(h).padStart(2, '0')}:00
            </span>
          </div>
        ))}

        {nowOffset !== null && nowOffset >= 0 && nowOffset <= totalH && (
          <div
            className="pointer-events-none absolute inset-x-0 z-10 border-t border-[#5eb6ff]"
            style={{ top: nowOffset }}
          >
            <span className="absolute -top-2 left-12 rounded-full bg-[#5eb6ff] px-1 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.3px] text-black">
              jetzt
            </span>
          </div>
        )}

        {/* Create-drag highlight */}
        {createDrag && (
          <div
            className="pointer-events-none absolute left-14 right-2 z-20 rounded-[6px] border-2 border-dashed border-[#5eb6ff] bg-[#5eb6ff]/[0.12]"
            style={{
              top: (Math.min(createDrag.startHour, createDrag.currentHour) - START_H) * HOUR_H,
              height:
                (Math.abs(createDrag.currentHour - createDrag.startHour) || 0.25) * HOUR_H,
            }}
          >
            <span className="absolute -top-5 left-0 rounded-[3px] bg-[#5eb6ff] px-1 py-0.5 font-mono text-[9px] uppercase tracking-[0.3px] text-black">
              Neuer Termin
            </span>
          </div>
        )}

        <div className="absolute inset-y-0 left-14 right-2">
          {dayEvents.map((e) => {
            const s = new Date(e.startsAt);
            const en = new Date(e.endsAt);
            const startHour = Math.max(START_H, s.getHours() + s.getMinutes() / 60);
            const endHour = Math.min(END_H, en.getHours() + en.getMinutes() / 60);
            if (endHour <= START_H || startHour >= END_H) return null;
            const top = (startHour - START_H) * HOUR_H;
            const height = (endHour - startHour) * HOUR_H;
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
                className="absolute left-0 right-0 flex flex-col gap-0.5 overflow-hidden rounded-[6px] px-2 py-1 text-left transition-all hover:brightness-125"
                style={{
                  top,
                  height: Math.max(28, height),
                  background: `${meta.color}22`,
                  boxShadow: `inset 0 0 0 1px ${meta.color}55`,
                }}
              >
                <div
                  className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.3px]"
                  style={{ color: meta.color }}
                >
                  <span>{meta.icon}</span>
                  <span>
                    {s.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    {' – '}
                    {en.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <span className="text-[13px] font-medium leading-tight text-ink-50">
                  {e.title}
                </span>
                {e.linkedCustomerName && (
                  <span className="text-[11px] text-ink-200">◉ {e.linkedCustomerName}</span>
                )}
                {e.linkedVehiclePlate && (
                  <span className="font-mono text-[11px] text-ink-200">
                    ⊞ {e.linkedVehiclePlate}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
