'use client';

/**
 * Booking-card style event chip for the time-grid views (week/day), modelled
 * on the CARJOY reference: a solid dark card with a thin colour accent bar on
 * the left (the event kind), a white title, a muted address/subtitle line and
 * a stack of small avatars at the bottom. Presentational — the parent computes
 * top/height (+ optional lane left/width for side-by-side overlaps) and wires
 * the drag handlers; this just draws and animates.
 */
import { motion } from 'framer-motion';
import type { ComponentProps } from 'react';
import { Avatar } from '@/components/channel/avatar';
import { KIND_META } from './event-color';
import { chipVariants } from './_motion';
import type { CalendarEvent } from '@/lib/types';

type MotionButtonProps = ComponentProps<typeof motion.button>;

export function EventChip({
  event,
  top,
  height,
  leftPct,
  widthPct,
  dragged = false,
  ...rest
}: {
  event: CalendarEvent;
  top: number;
  height: number;
  /** Lane positioning for overlapping events; defaults to full width. */
  leftPct?: number;
  widthPct?: number;
  dragged?: boolean;
} & MotionButtonProps) {
  const meta = KIND_META[event.kind];
  const h = Math.max(22, height);
  const showSub = h >= 46;
  const showAvatars = h >= 60;
  const isDone = !!event.completedAt;
  const subtitle = event.location ?? event.linkedCustomerName ?? null;

  // Attendees drive the avatar stack; fall back to the creator if an event
  // has none yet (legacy events). Show up to 3, then a "+N" overflow chip.
  const people: { initials: string; from: string; to: string }[] =
    event.attendees && event.attendees.length > 0
      ? event.attendees.map((a) => ({ initials: a.initials, from: a.from, to: a.to }))
      : event.createdBy
        ? [{ initials: event.createdBy.initials, from: event.createdBy.from, to: event.createdBy.to }]
        : [];
  const MAX_AVATARS = 3;
  const avatars = people.slice(0, MAX_AVATARS);
  const overflow = people.length - avatars.length;
  const source = event.source ?? 'internal';
  const overlay = source === 'google' || source === 'todo';
  const sourceTag = source === 'google' ? 'G' : source === 'todo' ? '✓' : null;

  return (
    <motion.button
      type="button"
      data-event-card
      variants={chipVariants}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.15 }}
      className="group/chip pointer-events-auto absolute z-20 flex flex-col overflow-hidden rounded-[8px] pl-2.5 pr-2 py-1.5 text-left transition-[filter,box-shadow] duration-150 ease-out hover:brightness-[1.18]"
      style={{
        top,
        height: h,
        left: leftPct !== undefined ? `calc(${leftPct}% + 3px)` : 3,
        width: widthPct !== undefined ? `calc(${widthPct}% - 6px)` : 'calc(100% - 6px)',
        background: overlay ? 'rgba(23,23,27,0.6)' : '#17171b',
        boxShadow: [
          `inset 3px 0 0 0 ${meta.color}`,
          overlay
            ? `inset 0 0 0 1px ${meta.color}40`
            : `inset 0 0 0 1px rgba(255,255,255,.06)`,
          `0 1px 3px rgba(0,0,0,.45)`,
        ].join(', '),
        opacity: dragged ? 0.4 : isDone ? 0.6 : 1,
      }}
      title={`${meta.label} · ${event.title}`}
      {...rest}
    >
      <span
        className={`flex items-center gap-1 text-[12px] font-medium leading-tight text-ink-50 ${
          isDone ? 'line-through decoration-ink-300/50' : ''
        }`}
      >
        {sourceTag && (
          <span
            aria-hidden
            className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] font-mono text-[8px] leading-none"
            style={{ background: `${meta.color}26`, color: meta.color }}
          >
            {sourceTag}
          </span>
        )}
        <span className="truncate">{event.title}</span>
      </span>
      {showSub && subtitle && (
        <span className="mt-0.5 truncate text-[11px] leading-tight text-ink-300">{subtitle}</span>
      )}
      {showAvatars && avatars.length > 0 && (
        <span className="mt-auto flex items-center pt-1">
          {avatars.map((a, i) => (
            <span
              key={i}
              className="rounded-full"
              style={{ marginLeft: i === 0 ? 0 : -6, boxShadow: '0 0 0 2px #17171b' }}
            >
              <Avatar initials={a.initials} from={a.from} to={a.to} size={18} />
            </span>
          ))}
          {overflow > 0 && (
            <span
              className="ml-1 inline-flex h-[18px] items-center justify-center rounded-full bg-white/[0.08] px-1.5 text-[10px] font-medium text-ink-200"
              style={{ boxShadow: '0 0 0 2px #17171b' }}
            >
              +{overflow}
            </span>
          )}
        </span>
      )}
    </motion.button>
  );
}
