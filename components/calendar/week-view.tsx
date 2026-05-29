'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { rescheduleEvent } from '@/lib/actions/calendar';
import { EventChip } from './event-chip';
import { gridStagger } from './_motion';
import type { CalendarEvent } from '@/lib/types';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOUR_H = 80;
const START_H = 7;
const END_H = 21;
const AXIS_W = 56;

type CreateDrag = {
  dow: number;
  startHour: number;
  currentHour: number;
};

/** Greedy lane assignment so overlapping events sit side-by-side. */
function layoutLanes(evs: CalendarEvent[]): Map<string, { lane: number; lanes: number }> {
  const out = new Map<string, { lane: number; lanes: number }>();
  const sorted = [...evs].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  );
  const ms = (s: string) => new Date(s).getTime();
  let cluster: CalendarEvent[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const laneEnds: number[] = [];
    const placed: { e: CalendarEvent; lane: number }[] = [];
    for (const e of cluster) {
      const s = ms(e.startsAt);
      let lane = laneEnds.findIndex((end) => end <= s);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(ms(e.endsAt));
      } else {
        laneEnds[lane] = ms(e.endsAt);
      }
      placed.push({ e, lane });
    }
    const lanes = laneEnds.length;
    for (const p of placed) out.set(p.e.id, { lane: p.lane, lanes });
    cluster = [];
  };

  for (const e of sorted) {
    if (cluster.length && ms(e.startsAt) >= clusterEnd) flush();
    cluster.push(e);
    clusterEnd = Math.max(clusterEnd, ms(e.endsAt));
  }
  if (cluster.length) flush();
  return out;
}

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
  const [now, setNow] = useState<Date>(() => new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

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
      const s = new Date(e.startsAt);
      const dayIdx = Math.floor((s.getTime() - weekStart.getTime()) / 86_400_000);
      if (dayIdx >= 0 && dayIdx < 7) m.get(dayIdx)!.push(e);
    }
    return m;
  }, [events, weekStart]);

  // Per-day occupied-hour sets → drives the diagonal-hatch on empty tiles.
  const occupiedByDay = useMemo(() => {
    const m = new Map<number, Set<number>>();
    for (let i = 0; i < 7; i++) m.set(i, new Set());
    for (const [dow, evs] of eventsByDay) {
      const set = m.get(dow)!;
      for (const e of evs) {
        const s = new Date(e.startsAt);
        const en = new Date(e.endsAt);
        const lo = Math.floor(s.getHours() + s.getMinutes() / 60);
        const hi = Math.ceil(en.getHours() + en.getMinutes() / 60);
        for (let h = Math.max(START_H, lo); h < Math.min(END_H, hi); h++) set.add(h);
      }
    }
    return m;
  }, [eventsByDay]);

  const lanesByDay = useMemo(() => {
    const m = new Map<number, Map<string, { lane: number; lanes: number }>>();
    for (const [dow, evs] of eventsByDay) m.set(dow, layoutLanes(evs));
    return m;
  }, [eventsByDay]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const todayDow = days.findIndex((d) => d.toISOString().slice(0, 10) === todayIso);
  const totalH = (END_H - START_H) * HOUR_H;
  const hours = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);

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

  const beginCreate = (dow: number, hour: number) => {
    if (!onCreateAt || draggedId) return;
    setCreateDrag({ dow, startHour: hour, currentHour: hour + 1 });
  };

  const hourFromY = (clientY: number): number => {
    if (!containerRef.current) return START_H;
    const rect = containerRef.current.getBoundingClientRect();
    const y = clientY - rect.top;
    const ratio = Math.max(0, Math.min(1, y / totalH));
    return Math.round((START_H + ratio * (END_H - START_H)) * 2) / 2;
  };

  useEffect(() => {
    if (!createDrag) return;
    const onMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const colW = rect.width / 7;
      const dow = Math.max(0, Math.min(6, Math.floor(x / colW)));
      setCreateDrag((prev) => (prev ? { ...prev, dow, currentHour: hourFromY(e.clientY) } : null));
    };
    const onUp = () => {
      setCreateDrag((cur) => {
        if (cur && onCreateAt) {
          const lo = Math.min(cur.startHour, cur.currentHour);
          const hi = Math.max(cur.startHour, cur.currentHour);
          const minutes = Math.max(15, (hi - lo) * 60);
          const startTs = new Date(weekStart.getTime() + cur.dow * 86_400_000);
          const hh = Math.floor(lo);
          const mm = Math.round((lo - hh) * 60);
          startTs.setHours(hh, mm, 0, 0);
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

  const nowFloat = now.getHours() + now.getMinutes() / 60;
  const nowVisible = nowFloat >= START_H && nowFloat <= END_H;
  const nowTop = (nowFloat - START_H) * HOUR_H;

  return (
    <div className="overflow-hidden rounded-[16px] border border-white/[0.06] bg-[#0d0d0f] shadow-panel">
      {/* Day headers */}
      <div className="flex border-b border-white/[0.05]">
        <div className="grid flex-1" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {days.map((d, i) => {
            const iso = d.toISOString().slice(0, 10);
            const isToday = iso === todayIso;
            return (
              <div key={i} className="px-3 py-3">
                <div
                  className={`rounded-[10px] px-2 py-1.5 text-center transition-colors ${
                    isToday ? 'bg-white/[0.05] shadow-[inset_0_0_0_1px_rgba(255,255,255,.06)]' : ''
                  }`}
                >
                  <div
                    className={`text-[11px] font-medium ${
                      isToday ? 'text-ink-50' : 'text-ink-300'
                    }`}
                  >
                    {DOW[i]}
                  </div>
                  <div
                    className={`mt-0.5 text-[18px] font-semibold tabular-nums ${
                      isToday ? 'text-ink-50' : 'text-ink-200'
                    }`}
                  >
                    {d.getDate()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ width: AXIS_W }} />
      </div>

      {/* Body: day columns + right time axis */}
      <div className="flex">
        <div
          ref={containerRef}
          className="grid flex-1"
          style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}
        >
          {days.map((_, dow) => {
            const occupied = occupiedByDay.get(dow)!;
            const lanes = lanesByDay.get(dow)!;
            const isTodayCol = dow === todayDow;
            return (
              <motion.div
                key={dow}
                variants={gridStagger}
                initial="hidden"
                animate="show"
                className={`relative border-l border-white/[0.04] ${dow === 6 ? 'border-r' : ''}`}
                style={{ height: totalH }}
              >
                {/* Background tiles — diagonal hatch when empty */}
                {hours.map((h, i) => {
                  const slotHover = hoverSlot?.dow === dow && hoverSlot?.hour === h;
                  const empty = !occupied.has(h);
                  return (
                    <div
                      key={h}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        if ((e.target as HTMLElement).closest('[data-event-card]')) return;
                        beginCreate(dow, h);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (!slotHover) setHoverSlot({ dow, hour: h });
                      }}
                      onDragLeave={() => slotHover && setHoverSlot(null)}
                      onDrop={() => handleDrop(dow, h)}
                      className="absolute left-[3px] right-[3px] cursor-cell rounded-[7px] transition-colors"
                      style={{
                        top: i * HOUR_H + 2,
                        height: HOUR_H - 4,
                        background: slotHover
                          ? 'rgba(94,182,255,.10)'
                          : empty
                            ? '#0f0f12'
                            : 'transparent',
                        backgroundImage:
                          empty && !slotHover
                            ? 'repeating-linear-gradient(135deg, rgba(255,255,255,.035) 0px, rgba(255,255,255,.035) 1px, transparent 1px, transparent 7px)'
                            : undefined,
                        boxShadow: empty ? 'inset 0 0 0 1px rgba(255,255,255,.025)' : undefined,
                      }}
                    />
                  );
                })}

                {/* Faint now-line in today's column */}
                {isTodayCol && nowVisible && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 z-10"
                    style={{
                      top: nowTop,
                      height: 1,
                      background:
                        'linear-gradient(90deg, #5eb6ff 0%, rgba(94,182,255,.25) 70%, transparent 100%)',
                    }}
                  />
                )}

                {/* Create-drag highlight */}
                {createDrag && createDrag.dow === dow && (
                  <div
                    className="pointer-events-none absolute left-[3px] right-[3px] z-30 rounded-[8px] border-2 border-dashed border-[#5eb6ff] bg-[#5eb6ff]/[0.10]"
                    style={{
                      top: (Math.min(createDrag.startHour, createDrag.currentHour) - START_H) * HOUR_H,
                      height: (Math.abs(createDrag.currentHour - createDrag.startHour) || 1) * HOUR_H,
                    }}
                  >
                    <span className="absolute -top-5 left-0 rounded-[4px] bg-[#5eb6ff] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.3px] text-black">
                      Neuer Termin
                    </span>
                  </div>
                )}

                {/* Event cards */}
                {(eventsByDay.get(dow) ?? []).map((e) => {
                  const s = new Date(e.startsAt);
                  const en = new Date(e.endsAt);
                  const sh = s.getHours() + s.getMinutes() / 60;
                  const eh = en.getHours() + en.getMinutes() / 60;
                  if (eh <= START_H || sh >= END_H) return null;
                  const top = (Math.max(START_H, sh) - START_H) * HOUR_H;
                  const height = (Math.min(END_H, eh) - Math.max(START_H, sh)) * HOUR_H;
                  const lane = lanes.get(e.id) ?? { lane: 0, lanes: 1 };
                  const isInternal = (e.source ?? 'internal') === 'internal';
                  return (
                    <EventChip
                      key={e.id}
                      event={e}
                      top={top}
                      height={height}
                      leftPct={(lane.lane / lane.lanes) * 100}
                      widthPct={100 / lane.lanes}
                      dragged={draggedId === e.id}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onOpen(e.id);
                      }}
                      onMouseDown={(ev) => ev.stopPropagation()}
                      draggable={isInternal}
                      onDragStart={isInternal ? () => setDraggedId(e.id) : undefined}
                      onDragEnd={isInternal ? () => setDraggedId(null) : undefined}
                    />
                  );
                })}
              </motion.div>
            );
          })}
        </div>

        {/* Right time axis */}
        <div className="relative shrink-0" style={{ width: AXIS_W, height: totalH }}>
          {hours.map((h, i) => (
            <div
              key={h}
              className="absolute right-3 font-mono text-[11px] tabular-nums text-ink-300"
              style={{ top: i * HOUR_H + 3 }}
            >
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
          {nowVisible && (
            <div
              className="absolute right-2 z-10 flex items-center gap-1"
              style={{ top: nowTop - 8 }}
            >
              <span
                className="font-mono text-[11px] font-medium tabular-nums text-[#5eb6ff]"
              >
                {now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span
                aria-hidden
                className="inline-block"
                style={{
                  width: 0,
                  height: 0,
                  borderTop: '4px solid transparent',
                  borderBottom: '4px solid transparent',
                  borderRight: '5px solid #5eb6ff',
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
