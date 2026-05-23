'use client';

import { useMemo, useTransition } from 'react';
import { Avatar } from '@/components/channel/avatar';
import { DuePill, PriorityPill, StatusPill } from './todo-pill';
import { setTodoStatus } from '@/lib/actions/todos';
import { TodoRow } from './todo-row';
import type { Todo } from '@/lib/types';

const PRIORITY_RANK = { urgent: 0, hoch: 1, mittel: 2, niedrig: 3 } as const;

function focusOrder(a: Todo, b: Todo): number {
  // Overdue first, then due-time, then priority
  const aT = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
  const bT = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
  if (aT !== bT) return aT - bT;
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
}

export function TodoFocusView({
  todos,
  onOpen,
}: {
  todos: Todo[];
  onOpen: (id: string) => void;
}) {
  const [pending, start] = useTransition();

  const open = useMemo(
    () => todos.filter((t) => t.status === 'offen' || t.status === 'in_arbeit').sort(focusOrder),
    [todos]
  );

  if (open.length === 0) {
    return (
      <div className="rounded-[14px] border border-white/[0.08] bg-[rgba(20,21,23,0.5)] py-16 text-center">
        <div className="text-[36px] leading-none">✨</div>
        <h3 className="mt-4 text-[18px] font-medium text-ink-50">Alle Todos erledigt.</h3>
        <p className="mt-2 text-[13.5px] text-ink-300">
          Tipp dir <kbd className="mx-1 rounded border border-white/[0.15] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10.5px]">⌘T</kbd> für die nächste Notiz.
        </p>
      </div>
    );
  }

  const [hero, ...rest] = open;

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={() => onOpen(hero.id)}
        className="group flex flex-col gap-4 rounded-[18px] border border-white/[0.10] bg-[linear-gradient(180deg,#1a1c22_0%,#0e0f12_100%)] p-7 text-left shadow-panel transition-colors duration-200 hover:border-white/[0.20]"
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            Als nächstes
          </span>
          <StatusPill status={hero.status} />
          {hero.autoRuleSlug && (
            <span className="rounded-full border border-[#c084fc]/30 bg-[#c084fc]/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.3px] text-[#c084fc]">
              auto
            </span>
          )}
        </div>
        <h2 className="text-[28px] font-medium leading-[1.15] tracking-[-0.3px] text-ink-50">
          {hero.title}
        </h2>
        {hero.description && (
          <p className="line-clamp-3 max-w-[640px] text-[14px] leading-[1.6] text-ink-200">
            {hero.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <DuePill iso={hero.dueAt} />
          <PriorityPill priority={hero.priority} />
          {hero.assignee && (
            <div className="inline-flex items-center gap-1.5 text-[12px] text-ink-200">
              <Avatar
                initials={hero.assignee.initials}
                from={hero.assignee.from}
                to={hero.assignee.to}
                size={20}
              />
              {hero.assignee.name}
            </div>
          )}
          {hero.subtaskTotal > 0 && (
            <span className="font-mono text-[11px] uppercase tracking-[0.3px] text-ink-300">
              {hero.subtaskDone}/{hero.subtaskTotal} Sub-Tasks
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={(e) => {
              e.stopPropagation();
              start(async () => {
                await setTodoStatus(hero.id, 'erledigt');
              });
            }}
            className="rounded-full bg-white px-4 py-2 text-[12.5px] font-medium leading-none text-black transition-opacity hover:bg-white/90 disabled:opacity-30"
          >
            Erledigt
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={(e) => {
              e.stopPropagation();
              start(async () => {
                await setTodoStatus(hero.id, hero.status === 'in_arbeit' ? 'offen' : 'in_arbeit');
              });
            }}
            className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[12.5px] font-medium leading-none text-ink-50 transition-colors hover:border-white/[0.18] hover:bg-white/[0.06] disabled:opacity-30"
          >
            {hero.status === 'in_arbeit' ? 'Pausieren' : 'Starten'}
          </button>
          <span className="ml-auto font-mono text-[10.5px] uppercase tracking-[0.3px] text-ink-300">
            Klick für Details
          </span>
        </div>
      </button>

      {rest.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="px-3 font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-300">
            Danach · {rest.length}
          </h3>
          <div className="flex flex-col gap-0.5">
            {rest.slice(0, 8).map((t) => (
              <TodoRow key={t.id} todo={t} onOpen={onOpen} compact />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
