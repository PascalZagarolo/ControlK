'use client';

// Read-only week view for the Google-Calendar mirror
// (external_calendar_events table). Distinct from week-view.tsx
// which renders the workspace-scoped rental events with their
// drag-create / drag-move / kind-color logic. The two surfaces will
// merge in a later phase; for now this lives alongside, owned by
// `/calendar/week`.

import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, isSameDay, startOfDay } from '@/lib/calendar-time';
import type {
  CalendarPrefs,
  ExternalEvent,
} from '@/lib/db/queries/external-calendar';
import type { ExternalEventStatus } from '@/lib/actions/event-metadata';
import { EventDetailPopover } from './event-detail-popover';

const STATUS_DOT_COLOR: Record<Exclude<ExternalEventStatus, null>, string> = {
  prep_needed: '#E8B86D',
  prepared: '#5FCFA8',
  follow_up_due: '#FF8A5C',
  completed: '#52525B',
};

// Layout constants — changing HOUR_HEIGHT_PX rescales everything
// because event blocks compute pixels from minutes.
const HOUR_HEIGHT_PX = 56;
const TIME_COL_WIDTH_PX = 64;
const VISIBLE_START_HOUR = 7;
const VISIBLE_END_HOUR = 22;

export function ExternalWeekView({
  weekStartISO,
  events,
  prefs,
  todayISO,
}: {
  weekStartISO: string;
  events: ExternalEvent[];
  prefs: CalendarPrefs;
  todayISO: string;
}) {
  const weekStart = useMemo(() => new Date(weekStartISO), [weekStartISO]);
  const today = useMemo(() => new Date(todayISO), [todayISO]);
  const dayCount = prefs.showWeekends ? 7 : 5;
  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => addDays(weekStart, i)),
    [weekStart, dayCount]
  );

  // Current-time indicator: ticks every minute
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { allDayByDay, timedByDay } = useMemo(
    () => bucketEvents(events, days),
    [events, days]
  );

  // Popover state. We capture the anchor rect on click so the popover
  // can position itself relative to the clicked block.
  const [selected, setSelected] = useState<{
    event: ExternalEvent;
    anchor: { top: number; left: number; right: number; height: number };
  } | null>(null);

  // Scroll the working-hours-start into view on first paint
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scrollRef.current) return;
    const [h, m] = prefs.workingHoursStart.split(':').map(Number);
    const minutesFromVisibleStart =
      (h - VISIBLE_START_HOUR) * 60 + (m || 0) - 30;
    if (minutesFromVisibleStart > 0) {
      scrollRef.current.scrollTop = (minutesFromVisibleStart / 60) * HOUR_HEIGHT_PX;
    }
  }, [prefs.workingHoursStart]);

  const hours = Array.from(
    { length: VISIBLE_END_HOUR - VISIBLE_START_HOUR },
    (_, i) => VISIBLE_START_HOUR + i
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-ink-900">
      <div className="shrink-0 border-b border-[#1F1F23]">
        <div className="flex">
          <div
            className="shrink-0 border-r border-[#1F1F23]"
            style={{ width: TIME_COL_WIDTH_PX }}
            aria-hidden
          />
          {days.map((d) => {
            const isToday = isSameDay(d, today);
            const isPast = d < startOfDay(today) && !isToday;
            const header = formatDayHeader(d);
            return (
              <div
                key={d.toISOString()}
                className={`flex-1 border-r border-[#1F1F23] px-2 py-2 last:border-r-0 ${
                  isToday ? 'bg-[rgba(232,184,109,0.04)]' : ''
                }`}
              >
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={`font-mono text-[10px] uppercase tracking-[0.08em] ${
                      isToday
                        ? 'text-[#E8B86D]'
                        : isPast
                          ? 'text-[#3a3a3f]'
                          : 'text-ink-300'
                    }`}
                  >
                    {header.weekday}
                  </span>
                  <span
                    className={`text-[15px] leading-none ${
                      isToday
                        ? 'font-medium text-[#E8B86D]'
                        : isPast
                          ? 'text-[#3a3a3f]'
                          : 'text-ink-50'
                    }`}
                  >
                    {header.day}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <AllDayRow days={days} allDayByDay={allDayByDay} todayDate={today} />
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div
          className="relative flex"
          style={{ height: hours.length * HOUR_HEIGHT_PX }}
        >
          <div
            className="sticky left-0 z-10 shrink-0 border-r border-[#1F1F23] bg-ink-900"
            style={{ width: TIME_COL_WIDTH_PX }}
          >
            {hours.map((h) => (
              <div
                key={h}
                className="relative flex items-start justify-end pr-2 pt-0.5"
                style={{ height: HOUR_HEIGHT_PX }}
              >
                <span className="font-mono text-[10.5px] leading-none text-ink-300">
                  {h.toString().padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {days.map((d) => {
            const isToday = isSameDay(d, today);
            return (
              <DayColumn
                key={d.toISOString()}
                day={d}
                isToday={isToday}
                events={timedByDay.get(d.toDateString()) ?? []}
                now={now}
                workingHoursStart={prefs.workingHoursStart}
                workingHoursEnd={prefs.workingHoursEnd}
                onEventClick={(ev, anchor) => setSelected({ event: ev, anchor })}
              />
            );
          })}
        </div>
      </div>

      {selected && (
        <EventDetailPopover
          event={selected.event}
          anchor={selected.anchor}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
function DayColumn({
  day,
  isToday,
  events,
  now,
  workingHoursStart,
  workingHoursEnd,
  onEventClick,
}: {
  day: Date;
  isToday: boolean;
  events: ExternalEvent[];
  now: Date;
  workingHoursStart: string;
  workingHoursEnd: string;
  onEventClick: (
    ev: ExternalEvent,
    anchor: { top: number; left: number; right: number; height: number }
  ) => void;
}) {
  const dayStart = startOfDay(day);
  const hours = Array.from(
    { length: VISIBLE_END_HOUR - VISIBLE_START_HOUR },
    (_, i) => VISIBLE_START_HOUR + i
  );

  const laidOut = useMemo(() => layoutOverlaps(events), [events]);

  const [whStartH, whStartM] = workingHoursStart.split(':').map(Number);
  const [whEndH, whEndM] = workingHoursEnd.split(':').map(Number);
  const whTop =
    ((whStartH - VISIBLE_START_HOUR) * 60 + (whStartM || 0)) * (HOUR_HEIGHT_PX / 60);
  const whHeight =
    ((whEndH - whStartH) * 60 + ((whEndM || 0) - (whStartM || 0))) *
    (HOUR_HEIGHT_PX / 60);

  const nowTop =
    isToday && now.getHours() >= VISIBLE_START_HOUR && now.getHours() < VISIBLE_END_HOUR
      ? ((now.getHours() - VISIBLE_START_HOUR) * 60 + now.getMinutes()) *
        (HOUR_HEIGHT_PX / 60)
      : null;

  return (
    <div
      className={`relative flex-1 border-r border-[#1F1F23] last:border-r-0 ${
        isToday ? 'bg-[rgba(232,184,109,0.025)]' : ''
      }`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bg-white/[0.012]"
        style={{ top: whTop, height: whHeight }}
      />

      {hours.map((h, i) => (
        <div
          key={`h-${h}`}
          className="absolute inset-x-0 border-t border-[#1F1F23]"
          style={{ top: i * HOUR_HEIGHT_PX }}
          aria-hidden
        />
      ))}
      {hours.map((h, i) => (
        <div
          key={`half-${h}`}
          className="absolute inset-x-0 border-t border-[#1F1F23]/30"
          style={{ top: i * HOUR_HEIGHT_PX + HOUR_HEIGHT_PX / 2 }}
          aria-hidden
        />
      ))}

      {laidOut.map(({ event, col, totalCols }) => (
        <EventBlock
          key={event.id}
          event={event}
          dayStart={dayStart}
          col={col}
          totalCols={totalCols}
          now={now}
          onClick={onEventClick}
        />
      ))}

      {nowTop !== null && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 z-20 h-px bg-[#E8B86D]"
          style={{ top: nowTop }}
        >
          <span
            className="absolute -top-[3px] -left-[4px] h-[7px] w-[7px] rounded-full bg-[#E8B86D]"
            aria-hidden
          />
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
function EventBlock({
  event,
  dayStart,
  col,
  totalCols,
  now,
  onClick,
}: {
  event: ExternalEvent;
  dayStart: Date;
  col: number;
  totalCols: number;
  now: Date;
  onClick: (
    ev: ExternalEvent,
    anchor: { top: number; left: number; right: number; height: number }
  ) => void;
}) {
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  const dayEnd = addDays(dayStart, 1);
  const visStart = start < dayStart ? dayStart : start;
  const visEnd = end > dayEnd ? dayEnd : end;

  const minutesFromVisibleStart =
    (visStart.getHours() - VISIBLE_START_HOUR) * 60 + visStart.getMinutes();
  const top = (minutesFromVisibleStart / 60) * HOUR_HEIGHT_PX;
  const durationMin = (visEnd.getTime() - visStart.getTime()) / 60_000;
  const height = Math.max(20, (durationMin / 60) * HOUR_HEIGHT_PX);

  const widthPct = 100 / totalCols;
  const leftPct = col * widthPct;
  const isPast = end < now;
  const isCancelled = event.status === 'cancelled';
  const isTentative = event.status === 'tentative';
  const compact = height < 38;
  const statusDot = event.userStatus ? STATUS_DOT_COLOR[event.userStatus] : null;

  return (
    <button
      type="button"
      title={`${event.title} · ${formatRange(start, end)}${event.location ? ' · ' + event.location : ''}`}
      onClick={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        onClick(event, {
          top: rect.top,
          left: rect.left,
          right: rect.right,
          height: rect.height,
        });
      }}
      className={`absolute overflow-hidden rounded-[4px] border-l-[3px] px-1.5 py-0.5 text-left transition-colors duration-100 ${
        isCancelled ? 'opacity-50' : isPast ? 'opacity-55' : ''
      } ${
        isTentative
          ? 'border-l-[#5E9EFF]/70 border-dashed bg-[#5E9EFF]/[0.10]'
          : 'border-l-[#E8B86D] bg-[#E8B86D]/[0.12]'
      } cursor-pointer hover:bg-[#E8B86D]/[0.20]`}
      style={{
        top,
        height,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 6px)`,
      }}
    >
      {/* Status indicator dot (top-right, 6px) */}
      {statusDot && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
          style={{ background: statusDot }}
        />
      )}
      {/* Notiz-Indicator: subtle pen-like dash if user has a note */}
      {event.hasUserNote && !statusDot && (
        <span
          aria-hidden
          title="Notiz vorhanden"
          className="pointer-events-none absolute right-1 top-1 h-1 w-2 rounded-full bg-ink-300/70"
        />
      )}
      <div className="flex h-full flex-col">
        <span className="font-mono text-[9.5px] leading-tight text-ink-300">
          {formatRange(start, end)}
        </span>
        <span
          className={`mt-0.5 truncate text-[11.5px] font-medium leading-tight text-ink-50 ${
            isCancelled ? 'line-through' : ''
          }`}
        >
          {event.title}
        </span>
        {!compact && event.location && (
          <span className="mt-0.5 truncate text-[10.5px] leading-tight text-ink-300">
            {event.location}
          </span>
        )}
      </div>
    </button>
  );
}

// ───────────────────────────────────────────────────────────────
function AllDayRow({
  days,
  allDayByDay,
  todayDate,
}: {
  days: Date[];
  allDayByDay: Map<string, ExternalEvent[]>;
  todayDate: Date;
}) {
  const anyAllDay = days.some(
    (d) => (allDayByDay.get(d.toDateString()) ?? []).length > 0
  );
  if (!anyAllDay) {
    return (
      <div className="flex h-[20px] items-center">
        <div className="shrink-0" style={{ width: TIME_COL_WIDTH_PX }} />
      </div>
    );
  }

  return (
    <div className="flex">
      <div
        className="flex shrink-0 items-start justify-end pr-2 pt-1.5"
        style={{ width: TIME_COL_WIDTH_PX }}
      >
        <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-ink-300">
          ganzt.
        </span>
      </div>
      {days.map((d) => {
        const items = allDayByDay.get(d.toDateString()) ?? [];
        const isToday = isSameDay(d, todayDate);
        const visible = items.slice(0, 2);
        const overflow = items.length - visible.length;
        return (
          <div
            key={d.toISOString()}
            className={`flex flex-1 flex-col gap-[2px] border-r border-[#1F1F23] px-1 py-1 last:border-r-0 ${
              isToday ? 'bg-[rgba(232,184,109,0.04)]' : ''
            }`}
          >
            {visible.map((ev) => (
              <div
                key={ev.id}
                title={ev.title}
                className="truncate rounded-[3px] bg-[#5FCFA8]/[0.18] px-1.5 py-[1px] text-[10.5px] text-[#5FCFA8]"
              >
                {ev.title}
              </div>
            ))}
            {overflow > 0 && (
              <div className="px-1 text-[10px] text-ink-300">+{overflow} mehr</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
function formatRange(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatDayHeader(d: Date): { weekday: string; day: number } {
  return {
    weekday: d.toLocaleDateString('de-DE', { weekday: 'short' }),
    day: d.getDate(),
  };
}

function bucketEvents(
  events: ExternalEvent[],
  days: Date[]
): {
  allDayByDay: Map<string, ExternalEvent[]>;
  timedByDay: Map<string, ExternalEvent[]>;
} {
  const allDayByDay = new Map<string, ExternalEvent[]>();
  const timedByDay = new Map<string, ExternalEvent[]>();
  for (const d of days) {
    allDayByDay.set(d.toDateString(), []);
    timedByDay.set(d.toDateString(), []);
  }
  for (const ev of events) {
    const start = new Date(ev.startAt);
    const end = new Date(ev.endAt);
    for (const d of days) {
      const dayStart = startOfDay(d);
      const dayEnd = addDays(dayStart, 1);
      if (start < dayEnd && end > dayStart) {
        const bucket = ev.isAllDay ? allDayByDay : timedByDay;
        bucket.get(d.toDateString())!.push(ev);
      }
    }
  }
  for (const arr of timedByDay.values()) {
    arr.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }
  return { allDayByDay, timedByDay };
}

/**
 * Greedy column-packing for overlapping events. Walks events in
 * chronological order; each new event takes the lowest free column
 * within the current overlap-group. Group ends when no slot survives
 * to the next event's start. After the pass, every event in a group
 * gets the group's total column count so its width-percent can be
 * computed.
 */
function layoutOverlaps(
  events: ExternalEvent[]
): Array<{ event: ExternalEvent; col: number; totalCols: number }> {
  if (events.length === 0) return [];

  type Slot = { endsAt: number; col: number };
  const placed: Array<{ event: ExternalEvent; col: number; group: number }> = [];
  let active: Slot[] = [];
  let groupId = 0;
  const groupCols = new Map<number, number>();

  for (const ev of events) {
    const start = new Date(ev.startAt).getTime();
    const end = new Date(ev.endAt).getTime();
    active = active.filter((s) => s.endsAt > start);
    if (active.length === 0) groupId += 1;
    const used = new Set(active.map((s) => s.col));
    let col = 0;
    while (used.has(col)) col += 1;
    active.push({ endsAt: end, col });
    placed.push({ event: ev, col, group: groupId });
    groupCols.set(groupId, Math.max(groupCols.get(groupId) ?? 0, col + 1));
  }

  return placed.map((p) => ({
    event: p.event,
    col: p.col,
    totalCols: groupCols.get(p.group) ?? 1,
  }));
}
