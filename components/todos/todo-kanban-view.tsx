'use client';

import { useMemo, useTransition } from 'react';
import { Avatar } from '@/components/channel/avatar';
import { DuePill, PriorityPill } from './todo-pill';
import { setTodoStatus } from '@/lib/actions/todos';
import type { Todo, TodoStatus } from '@/lib/types';

const COLUMNS: { key: TodoStatus; label: string; dot: string }[] = [
  { key: 'offen', label: 'Offen', dot: 'bg-ink-300' },
  { key: 'in_arbeit', label: 'In Arbeit', dot: 'bg-[#5eb6ff]' },
  { key: 'erledigt', label: 'Erledigt', dot: 'bg-[#5ee08a]' },
  { key: 'abgebrochen', label: 'Abgebrochen', dot: 'bg-ink-300/60' },
];

export function TodoKanbanView({
  todos,
  onOpen,
}: {
  todos: Todo[];
  onOpen: (id: string) => void;
}) {
  const [pending, start] = useTransition();
  const byStatus = useMemo(() => {
    const m = new Map<TodoStatus, Todo[]>(COLUMNS.map((c) => [c.key, []]));
    for (const t of todos) m.get(t.status)?.push(t);
    return m;
  }, [todos]);

  const advance = (todo: Todo, next: TodoStatus) => {
    start(async () => {
      await setTodoStatus(todo.id, next);
    });
  };

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
      {COLUMNS.map((col) => {
        const items = byStatus.get(col.key) ?? [];
        return (
          <div
            key={col.key}
            className="flex min-h-[260px] flex-col gap-2 rounded-[14px] border border-white/[0.06] bg-[rgba(20,21,23,0.45)] p-3"
          >
            <div className="flex items-center gap-2 px-1">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${col.dot}`} />
              <h3 className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-300">
                {col.label}
              </h3>
              <span className="font-mono text-[10.5px] text-ink-300/70">{items.length}</span>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-1 items-center justify-center px-2 py-6 text-center text-[11.5px] text-ink-300/60">
                Leer
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {items.map((t) => (
                  <KanbanCard
                    key={t.id}
                    todo={t}
                    onOpen={() => onOpen(t.id)}
                    onAdvance={(next) => advance(t, next)}
                    disabled={pending}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({
  todo,
  onOpen,
  onAdvance,
  disabled,
}: {
  todo: Todo;
  onOpen: () => void;
  onAdvance: (next: TodoStatus) => void;
  disabled?: boolean;
}) {
  const nextStatus: Record<TodoStatus, TodoStatus | null> = {
    offen: 'in_arbeit',
    in_arbeit: 'erledigt',
    erledigt: 'offen',
    abgebrochen: 'offen',
  };
  const next = nextStatus[todo.status];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen();
      }}
      className="group cursor-pointer rounded-[10px] border border-white/[0.06] bg-[rgba(24,25,28,0.7)] p-3 transition-colors duration-150 hover:border-white/[0.14]"
    >
      <div className="flex items-start gap-2">
        <span className="line-clamp-2 flex-1 text-[13px] font-medium leading-tight text-ink-50">
          {todo.title}
        </span>
        {todo.autoRuleSlug && (
          <span className="shrink-0 rounded-full border border-[#c084fc]/30 bg-[#c084fc]/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.3px] text-[#c084fc]">
            auto
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <DuePill iso={todo.dueAt} />
        {(todo.priority === 'hoch' || todo.priority === 'urgent') && (
          <PriorityPill priority={todo.priority} />
        )}
        {todo.subtaskTotal > 0 && (
          <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
            {todo.subtaskDone}/{todo.subtaskTotal}
          </span>
        )}
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <div>
          {todo.assignee && (
            <Avatar
              initials={todo.assignee.initials}
              from={todo.assignee.from}
              to={todo.assignee.to}
              size={20}
            />
          )}
        </div>
        {next && (
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              onAdvance(next);
            }}
            className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.3px] text-ink-300 transition-colors hover:border-white/[0.14] hover:text-ink-50"
          >
            → {next.replace('_', ' ')}
          </button>
        )}
      </div>
    </div>
  );
}
