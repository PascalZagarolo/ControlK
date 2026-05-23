'use client';

import { useMemo, useState } from 'react';
import { PriorityPill } from './todo-pill';
import { Avatar } from '@/components/channel/avatar';
import type { Todo } from '@/lib/types';

function startOfWeek(d: Date): Date {
  const day = (d.getDay() + 6) % 7; // Monday = 0
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - day);
  return r;
}

export function TodoCalendarView({
  todos,
  onOpen,
}: {
  todos: Todo[];
  onOpen: (id: string) => void;
}) {
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(anchor.getTime() + i * 86_400_000)),
    [anchor]
  );

  const byDay = useMemo(() => {
    const map = new Map<string, Todo[]>();
    for (const d of days) map.set(d.toDateString(), []);
    const noDue: Todo[] = [];
    for (const t of todos) {
      if (!t.dueAt) {
        noDue.push(t);
        continue;
      }
      const d = new Date(t.dueAt);
      const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toDateString();
      const arr = map.get(key);
      if (arr) arr.push(t);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime());
    }
    return { map, noDue };
  }, [days, todos]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-300">
          {anchor.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}{' '}
          –{' '}
          {new Date(anchor.getTime() + 6 * 86_400_000).toLocaleDateString('de-DE', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </h3>
        <div className="flex items-center gap-1">
          <NavButton onClick={() => setAnchor(new Date(anchor.getTime() - 7 * 86_400_000))}>‹</NavButton>
          <NavButton onClick={() => setAnchor(startOfWeek(new Date()))}>Heute</NavButton>
          <NavButton onClick={() => setAnchor(new Date(anchor.getTime() + 7 * 86_400_000))}>›</NavButton>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
        {days.map((d) => {
          const items = byDay.map.get(d.toDateString()) ?? [];
          const isToday = sameDay(d, new Date());
          return (
            <div
              key={d.toDateString()}
              className={`flex min-h-[200px] flex-col rounded-[14px] border ${
                isToday
                  ? 'border-white/[0.18] bg-[rgba(28,29,32,0.6)]'
                  : 'border-white/[0.06] bg-[rgba(20,21,23,0.5)]'
              } p-3`}
            >
              <div className="mb-3 flex items-baseline justify-between">
                <span
                  className={`text-[13px] font-medium leading-none ${
                    isToday ? 'text-ink-50' : 'text-ink-200'
                  }`}
                >
                  {d.toLocaleDateString('de-DE', { weekday: 'short' })}
                </span>
                <span className="font-mono text-[12px] leading-none text-ink-300">
                  {d.getDate()}.
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {items.length === 0 ? (
                  <span className="text-[11px] text-ink-300/60">—</span>
                ) : (
                  items.map((t) => <DayChip key={t.id} todo={t} onClick={() => onOpen(t.id)} />)
                )}
              </div>
            </div>
          );
        })}
      </div>

      {byDay.noDue.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h3 className="px-1 font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-300">
            Kein Fälligkeitsdatum · {byDay.noDue.length}
          </h3>
          <div className="grid grid-cols-1 gap-1.5 md:grid-cols-3">
            {byDay.noDue.map((t) => (
              <DayChip key={t.id} todo={t} onClick={() => onOpen(t.id)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function NavButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[6px] border border-white/[0.06] bg-white/[0.02] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.3px] text-ink-200 transition-colors hover:border-white/[0.14] hover:text-ink-50"
    >
      {children}
    </button>
  );
}

function DayChip({ todo, onClick }: { todo: Todo; onClick: () => void }) {
  const time = todo.dueAt
    ? new Date(todo.dueAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : null;
  const done = todo.status === 'erledigt';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[6px] border border-l-2 px-2 py-1.5 text-left transition-colors duration-100 hover:bg-white/[0.04] ${
        done
          ? 'border-l-[#5ee08a]/60 border-white/[0.04] bg-white/[0.01]'
          : todo.priority === 'urgent'
            ? 'border-l-[#ff8a8a] border-white/[0.06] bg-white/[0.02]'
            : todo.priority === 'hoch'
              ? 'border-l-[#ffd96a] border-white/[0.06] bg-white/[0.02]'
              : 'border-l-[#5eb6ff]/50 border-white/[0.06] bg-white/[0.02]'
      }`}
    >
      {time && (
        <div className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">{time}</div>
      )}
      <div
        className={`mt-0.5 truncate text-[11.5px] leading-tight ${
          done ? 'text-ink-300 line-through' : 'text-ink-50'
        }`}
      >
        {todo.title}
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        {(todo.priority === 'urgent' || todo.priority === 'hoch') && (
          <PriorityPill priority={todo.priority} />
        )}
        {todo.assignee && (
          <Avatar
            initials={todo.assignee.initials}
            from={todo.assignee.from}
            to={todo.assignee.to}
            size={16}
          />
        )}
      </div>
    </button>
  );
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
