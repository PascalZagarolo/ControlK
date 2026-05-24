'use client';

/**
 * Group-detail page for /todos/[slug].
 *
 * - Breadcrumb header: Todos / [Project] · GroupName
 * - Group info block: name, description, stats
 * - Always-visible quick-input with parseTodoInput (heute/morgen/Mo/#tag)
 * - Open items list with inline expansion + status toggle
 * - Collapsible "Erledigt" section
 * - Empty state when no items
 *
 * Reuses existing server actions: createTodoFromForm, setTodoStatus,
 * updateTodoTitle, setTodoDue, deleteTodo.
 */

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createTodoFromForm, setTodoStatus, deleteTodo, setTodoDue } from '@/lib/actions/todos';
import { parseTodoInput } from '@/lib/todos/parse-quick-syntax';
import type { TodoPriority, TodoStatus } from '@/lib/types';

type DetailGroup = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  emoji?: string;
  projectId: string | null;
  projectName?: string;
  projectSlug?: string;
};

type DetailTodo = {
  id: string;
  title: string;
  status: TodoStatus;
  priority: TodoPriority;
  dueAt: string | null;
  description?: string;
};

type Stats = { open: number; done: number; dueToday: number };

export function TodoGroupDetailClient({
  group,
  openTodos,
  doneTodos,
  stats,
}: {
  group: DetailGroup;
  openTodos: DetailTodo[];
  doneTodos: Omit<DetailTodo, 'description'>[];
  stats: Stats;
}) {
  const router = useRouter();
  const [doneOpen, setDoneOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-[#0A0A0C] text-[#FAFAFA]">
      <div className="mx-auto w-full max-w-[820px] px-6 pt-[80px] pb-24">
        <Breadcrumb group={group} />

        <header className="mt-6">
          <h1 className="text-[28px] font-medium leading-tight text-[#FAFAFA]">
            {group.emoji && <span className="mr-2">{group.emoji}</span>}
            {group.name}
          </h1>
          {group.description && (
            <p className="mt-1.5 text-[14px] italic text-[#A1A1AA]">
              {group.description}
            </p>
          )}
          <p className="mt-3 text-[13px] text-[#A1A1AA]">
            {stats.open} offen · {stats.done} erledigt
            {stats.dueToday > 0 && (
              <>
                {' · '}
                <span className="text-[#E8B86D]">{stats.dueToday} fällig heute</span>
              </>
            )}
          </p>
        </header>

        <div className="mt-8">
          <TodoQuickInput
            groupId={group.id}
            projectId={group.projectId}
            onCreated={() => router.refresh()}
          />
        </div>

        {openTodos.length === 0 && doneTodos.length === 0 ? (
          <p className="mt-12 text-center text-[13px] italic text-[#52525B]">
            Noch keine Todos in dieser Gruppe. Schreib einfach drauf los.
          </p>
        ) : (
          <>
            <SectionLabel count={openTodos.length}>Offen</SectionLabel>
            {openTodos.length === 0 ? (
              <p className="mt-3 text-[13px] italic text-[#52525B]">
                Alles erledigt — Glückwunsch.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col divide-y divide-[#1F1F23]">
                <AnimatePresence initial={false}>
                  {openTodos.map((todo) => (
                    <TodoRow
                      key={todo.id}
                      todo={todo}
                      expanded={expandedId === todo.id}
                      onToggleExpand={() =>
                        setExpandedId((id) => (id === todo.id ? null : todo.id))
                      }
                      onChanged={() => router.refresh()}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            )}

            {doneTodos.length > 0 && (
              <div className="mt-8">
                <button
                  type="button"
                  onClick={() => setDoneOpen((v) => !v)}
                  className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.5px] text-[#52525B] transition-colors duration-150 hover:text-[#A1A1AA]"
                >
                  <span>{doneOpen ? '▾' : '▸'}</span>
                  Erledigt ({doneTodos.length})
                </button>
                <AnimatePresence initial={false}>
                  {doneOpen && (
                    <motion.ul
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.24, ease: 'easeOut' }}
                      className="mt-3 flex flex-col divide-y divide-[#1F1F23] overflow-hidden"
                    >
                      {doneTodos.map((todo) => (
                        <TodoRow
                          key={todo.id}
                          todo={{ ...todo, description: undefined }}
                          expanded={false}
                          onToggleExpand={() => {}}
                          onChanged={() => router.refresh()}
                        />
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

// ───────────────────────────────────────────────────────────────
// Breadcrumb
// ───────────────────────────────────────────────────────────────

function Breadcrumb({ group }: { group: DetailGroup }) {
  return (
    <nav className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.4px] text-[#52525B]">
      <Link href="/todos" className="inline-flex items-center gap-1 transition-colors hover:text-[#A1A1AA]">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Todos
      </Link>
      <span aria-hidden className="text-[#3a3a3f]">/</span>
      {group.projectName && group.projectSlug && (
        <>
          <Link
            href={`/todos?project=${group.projectSlug}`}
            className="transition-colors hover:text-[#A1A1AA]"
          >
            {group.projectName}
          </Link>
          <span aria-hidden className="text-[#3a3a3f]">·</span>
        </>
      )}
      {!group.projectName && (
        <>
          <span className="text-[#52525B]">Workspace</span>
          <span aria-hidden className="text-[#3a3a3f]">·</span>
        </>
      )}
      <span className="text-[#FAFAFA]">{group.name}</span>
    </nav>
  );
}

// ───────────────────────────────────────────────────────────────
// Quick-input
// ───────────────────────────────────────────────────────────────

function TodoQuickInput({
  groupId,
  projectId,
  onCreated,
}: {
  groupId: string;
  projectId: string | null;
  onCreated: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Focus on mount per brief
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    const parsed = parseTodoInput(value);
    if (!parsed.title) return;
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set('title', parsed.title);
      fd.set('groupId', groupId);
      if (projectId) fd.set('projectId', projectId);
      if (parsed.dueAt) fd.set('dueAt', parsed.dueAt.toISOString());
      // Tags are parsed but not yet persisted — we deliberately deferred a
      // generic tags-on-todos table. Tag tokens still get stripped from the
      // title so the UI is consistent.
      const res = await createTodoFromForm(fd);
      if (res.ok) {
        setValue('');
        onCreated();
      } else {
        setError(res.error ?? 'Fehler beim Anlegen');
      }
    });
  };

  return (
    <div>
      <div className="flex items-center gap-3 rounded-md border border-[#1F1F23] bg-[#161618] px-4 py-3 transition-colors duration-150 focus-within:border-[#2A2A30]">
        <span aria-hidden className="text-[14px] text-[#52525B]">+</span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Was muss erledigt werden? (Enter zum Speichern)"
          disabled={pending}
          className="flex-1 bg-transparent text-[14px] text-[#FAFAFA] outline-none placeholder:text-[#52525B] disabled:opacity-60"
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-[#52525B]">
          ↵
        </span>
      </div>
      {error && <p className="mt-2 text-[12px] text-[#ff8a8a]">{error}</p>}
      <p className="mt-1.5 text-[11px] text-[#52525B]">
        Tip: „<span className="text-[#A1A1AA]">heute</span>", „<span className="text-[#A1A1AA]">morgen</span>", „<span className="text-[#A1A1AA]">Mo</span>" → Fälligkeit · „<span className="text-[#A1A1AA]">#tag</span>" → Tag
      </p>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Section label
// ───────────────────────────────────────────────────────────────

function SectionLabel({ count, children }: { count: number; children: React.ReactNode }) {
  return (
    <p className="mt-10 font-mono text-[10.5px] uppercase tracking-[0.5px] text-[#52525B]">
      {children} ({count})
    </p>
  );
}

// ───────────────────────────────────────────────────────────────
// Todo row
// ───────────────────────────────────────────────────────────────

function TodoRow({
  todo,
  expanded,
  onToggleExpand,
  onChanged,
}: {
  todo: DetailTodo;
  expanded: boolean;
  onToggleExpand: () => void;
  onChanged: () => void;
}) {
  const [, start] = useTransition();
  const done = todo.status === 'erledigt' || todo.status === 'abgebrochen';

  const onToggleDone = (e: React.MouseEvent) => {
    e.stopPropagation();
    start(async () => {
      await setTodoStatus(todo.id, done ? 'offen' : 'erledigt');
      onChanged();
    });
  };

  const onDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Diesen Todo löschen?')) return;
    start(async () => {
      await deleteTodo(todo.id);
      onChanged();
    });
  };

  const onSetDue = (date: string | null) => {
    start(async () => {
      await setTodoDue(todo.id, date);
      onChanged();
    });
  };

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="group"
    >
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-center gap-3 py-2.5 text-left transition-colors duration-150 hover:bg-white/[0.015]"
      >
        <button
          type="button"
          onClick={onToggleDone}
          aria-label={done ? 'Wieder öffnen' : 'Erledigt markieren'}
          className="shrink-0 text-[#52525B] transition-colors duration-150 hover:text-[#FAFAFA]"
        >
          <Checkbox done={done} />
        </button>
        <span
          className={`min-w-0 flex-1 truncate text-[14px] transition-colors duration-300 ${
            done ? 'text-[#52525B] line-through decoration-[#52525B]/40' : 'text-[#FAFAFA]'
          }`}
        >
          {todo.title}
        </span>
        <span className="shrink-0 text-[12px] text-[#52525B]">
          {rightMeta(todo)}
        </span>
        <span
          aria-hidden
          className="shrink-0 px-2 text-[14px] text-[#3a3a3f] opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        >
          ⋯
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && !done && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="ml-7 mb-3 mt-1 rounded-md border border-[#1F1F23] bg-[#0E0E11] p-3 text-[12.5px] text-[#A1A1AA]">
              {todo.description ? (
                <p className="whitespace-pre-wrap">{todo.description}</p>
              ) : (
                <p className="italic text-[#52525B]">Keine Beschreibung.</p>
              )}
              <div className="mt-3 flex items-center gap-4 text-[12px]">
                <DueInput value={todo.dueAt} onChange={onSetDue} />
                <button
                  type="button"
                  onClick={onDelete}
                  className="ml-auto text-[#52525B] transition-colors hover:text-[#ff8a8a]"
                >
                  Löschen
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function Checkbox({ done }: { done: boolean }) {
  if (done) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="3" fill="currentColor" fillOpacity="0.05" />
        <polyline points="9 12 11 14 15 9" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="3" />
    </svg>
  );
}

function rightMeta(todo: DetailTodo): React.ReactNode {
  if (todo.priority === 'urgent' || todo.priority === 'hoch') {
    return todo.priority;
  }
  if (!todo.dueAt) return '';
  const days = Math.floor(
    (Date.parse(todo.dueAt) - new Date().setHours(0, 0, 0, 0)) / 86_400_000
  );
  if (days < 0) return <span className="text-[#ff8a8a]">überfällig</span>;
  if (days === 0) return <span className="text-[#E8B86D]">fällig heute</span>;
  if (days === 1) return 'morgen';
  if (days < 7) return `in ${days}T`;
  return new Date(todo.dueAt).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'short',
  });
}

function DueInput({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (date: string | null) => void;
}) {
  const local = value ? new Date(value).toISOString().slice(0, 10) : '';
  return (
    <label className="flex items-center gap-2 text-[#52525B]">
      <span>Fällig:</span>
      <input
        type="date"
        value={local}
        onChange={(e) => {
          if (!e.target.value) {
            onChange(null);
          } else {
            const d = new Date(e.target.value);
            d.setHours(12, 0, 0, 0);
            onChange(d.toISOString());
          }
        }}
        className="rounded border border-[#1F1F23] bg-[#0A0A0C] px-2 py-1 text-[12px] text-[#A1A1AA] outline-none focus:border-[#2A2A30]"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-[#52525B] hover:text-[#A1A1AA]"
        >
          ×
        </button>
      )}
    </label>
  );
}
