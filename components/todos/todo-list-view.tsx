'use client';

import { useMemo } from 'react';
import { TodoRow } from './todo-row';
import type { Todo } from '@/lib/types';

type Bucket = {
  key: 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'later' | 'no_due' | 'done';
  label: string;
  tone: 'red' | 'blue' | 'neutral' | 'green';
  items: Todo[];
};

function bucketize(todos: Todo[], now = Date.now()): Bucket[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const tomorrow = new Date(start.getTime() + 86_400_000);
  const dayAfter = new Date(tomorrow.getTime() + 86_400_000);
  const weekEnd = new Date(start.getTime() + 7 * 86_400_000);

  const buckets: Record<Bucket['key'], Todo[]> = {
    overdue: [],
    today: [],
    tomorrow: [],
    this_week: [],
    later: [],
    no_due: [],
    done: [],
  };

  for (const t of todos) {
    if (t.status === 'erledigt' || t.status === 'abgebrochen') {
      buckets.done.push(t);
      continue;
    }
    if (!t.dueAt) {
      buckets.no_due.push(t);
      continue;
    }
    const time = new Date(t.dueAt).getTime();
    if (time < start.getTime()) buckets.overdue.push(t);
    else if (time < tomorrow.getTime()) buckets.today.push(t);
    else if (time < dayAfter.getTime()) buckets.tomorrow.push(t);
    else if (time < weekEnd.getTime()) buckets.this_week.push(t);
    else buckets.later.push(t);
  }

  const out: Bucket[] = [
    { key: 'overdue', label: 'Überfällig', tone: 'red', items: buckets.overdue },
    { key: 'today', label: 'Heute', tone: 'blue', items: buckets.today },
    { key: 'tomorrow', label: 'Morgen', tone: 'blue', items: buckets.tomorrow },
    { key: 'this_week', label: 'Diese Woche', tone: 'neutral', items: buckets.this_week },
    { key: 'later', label: 'Später', tone: 'neutral', items: buckets.later },
    { key: 'no_due', label: 'Kein Fälligkeitsdatum', tone: 'neutral', items: buckets.no_due },
    { key: 'done', label: 'Erledigt / Abgebrochen', tone: 'green', items: buckets.done },
  ];
  return out.filter((b) => b.items.length > 0);
}

const TONE_DOT: Record<Bucket['tone'], string> = {
  red: 'bg-[#ff8a8a] shadow-[0_0_6px_rgba(255,138,138,0.6)]',
  blue: 'bg-[#5eb6ff] shadow-[0_0_6px_rgba(94,182,255,0.6)]',
  neutral: 'bg-ink-300',
  green: 'bg-[#5ee08a]',
};

export function TodoListView({
  todos,
  onOpen,
}: {
  todos: Todo[];
  onOpen: (id: string) => void;
}) {
  const buckets = useMemo(() => bucketize(todos), [todos]);

  if (todos.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-white/[0.10] bg-white/[0.01] py-14 text-center text-[14px] text-ink-300">
        Noch keine Todos. Drück <kbd className="mx-1 rounded border border-white/[0.15] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10.5px]">⌘T</kbd> für eine schnelle Erfassung.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      {buckets.map((b) => (
        <section key={b.key} className="flex flex-col gap-1.5">
          <div className="mb-1 flex items-center gap-2.5 px-3">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${TONE_DOT[b.tone]}`} />
            <h3 className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-300">
              {b.label}
            </h3>
            <span className="font-mono text-[10.5px] text-ink-300/70">{b.items.length}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            {b.items.map((t) => (
              <TodoRow key={t.id} todo={t} onOpen={onOpen} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
