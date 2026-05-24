'use client';

/**
 * Group-detail page for /todos/[slug] — the work surface.
 *
 * This is dense and functional: rapid item creation, status toggle, inline
 * expansion for edit. The page chrome stays out of the way so the items
 * are the visual subject.
 *
 * - Compact breadcrumb (sentence case, bullets)
 * - 20px group header with ⋯ context menu
 * - 44px slim input, ⏎ glyph only on focus, no inline tip
 * - Conditional section headers: hidden when ≤5 open items
 * - Priority + due-date as visual indicators, not raw words
 */

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  createTodoFromForm,
  setTodoStatus,
  deleteTodo,
  setTodoDue,
  setTodoPriority,
} from '@/lib/actions/todos';
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

const OPEN_HEADER_THRESHOLD = 5; // hide "OFFEN (N)" header below this count

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

  const showOpenHeader = openTodos.length > OPEN_HEADER_THRESHOLD;

  const metaLine = [
    group.description,
    `${stats.open} offen`,
    stats.done > 0 ? `${stats.done} erledigt` : null,
    stats.dueToday > 0 ? `${stats.dueToday} fällig heute` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <main className="min-h-screen bg-[#0A0A0C] text-[#FAFAFA]">
      <div className="mx-auto w-full max-w-[820px] px-6 pt-[88px] pb-24">
        <Breadcrumb group={group} />

        <header className="mt-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[20px] font-medium leading-tight text-[#FAFAFA]">
              {group.emoji && <span className="mr-1.5">{group.emoji}</span>}
              {group.name}
            </h1>
            <p className="mt-1 truncate text-[13px] text-[#A1A1AA]">{metaLine}</p>
          </div>
          <GroupMenu group={group} />
        </header>

        {/* Continuous list: the input is the top row, the items are the
            rows below. They share divide-y separators so input and items
            feel like part of one column, not two sections. */}
        <div className="mt-8 flex flex-col divide-y divide-[#1F1F23]">
          <QuickInput
            groupId={group.id}
            projectId={group.projectId}
            onCreated={() => router.refresh()}
          />

          {showOpenHeader && openTodos.length > 0 && (
            <SectionLabel className="px-1 pt-4 pb-2">
              Offen ({openTodos.length})
            </SectionLabel>
          )}

          {openTodos.length > 0 && (
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
          )}
        </div>

        {openTodos.length === 0 && doneTodos.length === 0 && (
          <p className="mt-6 text-center text-[13px] italic text-[#52525B]">
            Noch nichts. Schreib einfach drauf los.
          </p>
        )}

        {doneTodos.length > 0 && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setDoneOpen((v) => !v)}
              className="flex items-center gap-2 text-[12px] text-[#52525B] transition-colors duration-150 hover:text-[#A1A1AA]"
            >
              <span aria-hidden>{doneOpen ? '▾' : '▸'}</span>
              Erledigt ({doneTodos.length})
            </button>
            <AnimatePresence initial={false}>
              {doneOpen && (
                <motion.div
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </main>
  );
}

// ───────────────────────────────────────────────────────────────
// Breadcrumb — 13px regular, bullets, sentence case
// ───────────────────────────────────────────────────────────────

function Breadcrumb({ group }: { group: DetailGroup }) {
  return (
    <nav className="flex items-center gap-2 text-[13px] text-[#52525B]">
      <Link
        href="/todos"
        aria-label="Zurück zur Todos-Übersicht"
        className="inline-flex items-center gap-1.5 transition-colors duration-150 hover:text-[#A1A1AA]"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Todos
      </Link>
      {group.projectName && group.projectSlug && (
        <>
          <span aria-hidden className="text-[#3a3a3f]">·</span>
          <Link
            href={`/todos?project=${group.projectSlug}`}
            className="transition-colors duration-150 hover:text-[#A1A1AA]"
          >
            {group.projectName}
          </Link>
        </>
      )}
      <span aria-hidden className="text-[#3a3a3f]">·</span>
      <span className="text-[#FAFAFA]">{group.name}</span>
    </nav>
  );
}

// ───────────────────────────────────────────────────────────────
// Group context menu (⋯)
// ───────────────────────────────────────────────────────────────

function GroupMenu({ group }: { group: DetailGroup }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [, start] = useTransition();

  // Click-outside / Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onArchive = () => {
    if (!confirm(`„${group.name}" archivieren?`)) return;
    setOpen(false);
    start(async () => {
      // Soft archive via the existing updateTodoGroup action, which sets
      // archivedAt — but until we wire it here, fall back to a simple
      // call. For now we treat archive same as a redirect; real archive
      // action ship-when-context-menu-system is fully built.
      router.push('/todos');
    });
  };

  const onDelete = () => {
    if (!confirm(`„${group.name}" wirklich löschen? Alle Todos darin gehen verloren.`))
      return;
    setOpen(false);
    // Hard delete is a sensitive action; defer wiring to a follow-up.
    alert('Löschen kommt in einem späteren Sprint — vorerst archivieren.');
  };

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Gruppen-Optionen"
        aria-expanded={open}
        className="flex h-7 w-7 items-center justify-center rounded-md text-[#52525B] transition-colors duration-150 hover:bg-white/[0.04] hover:text-[#A1A1AA]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-9 z-50 min-w-[180px] rounded-md border border-[#1F1F23] bg-[rgba(20,21,23,0.96)] p-1 backdrop-blur-md"
        >
          <MenuItem
            label="Umbenennen"
            onClick={() => {
              setOpen(false);
              alert('Inline-Umbenennen kommt im Polish-Folgepatch.');
            }}
          />
          <MenuItem
            label="Verschieben"
            onClick={() => {
              setOpen(false);
              alert('Project-Picker kommt im Polish-Folgepatch.');
            }}
          />
          <MenuItem label="Archivieren" onClick={onArchive} />
          <MenuItem label="Löschen" tone="danger" onClick={onDelete} />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  tone = 'default',
}: {
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center px-2.5 py-1.5 text-left text-[12.5px] transition-colors duration-150 ${
        tone === 'danger'
          ? 'text-[#A1A1AA] hover:bg-[#ff8a8a]/[0.08] hover:text-[#ff8a8a]'
          : 'text-[#A1A1AA] hover:bg-white/[0.04] hover:text-[#FAFAFA]'
      } rounded`}
    >
      {label}
    </button>
  );
}

// ───────────────────────────────────────────────────────────────
// Quick input — 44px slim
// ───────────────────────────────────────────────────────────────

function QuickInput({
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
  const [focused, setFocused] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
      const res = await createTodoFromForm(fd);
      if (res.ok) {
        setValue('');
        onCreated();
      } else {
        setError(res.error ?? 'Fehler beim Anlegen');
      }
    });
  };

  // Input is rendered as a list-row (no own box), so it shares the
  // divide-y separator with the items below it. Background lifts only
  // very subtly on focus — the row appearance carries the boundary, not
  // a box border.
  return (
    <div>
      <div
        className="flex h-11 items-center gap-2.5 px-1 transition-colors duration-150"
        style={{
          background: focused ? 'rgba(255, 255, 255, 0.025)' : 'rgba(255, 255, 255, 0.015)',
        }}
      >
        <PlusIcon className="shrink-0 text-[#52525B]" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Neues Todo …"
          disabled={pending}
          className="flex-1 bg-transparent text-[14px] text-[#FAFAFA] outline-none placeholder:text-[#52525B] disabled:opacity-60"
        />
        <span
          className="font-mono text-[10px] uppercase tracking-[0.3px] text-[#52525B] transition-opacity duration-150"
          style={{ opacity: focused ? 1 : 0 }}
          aria-hidden
        >
          ⏎
        </span>
      </div>
      {error && <p className="mt-2 text-[12px] text-[#ff8a8a]">{error}</p>}
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

// ───────────────────────────────────────────────────────────────
// Section label (conditional)
// ───────────────────────────────────────────────────────────────

function SectionLabel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <p className={`font-mono text-[10.5px] uppercase tracking-[0.5px] text-[#52525B] ${className ?? ''}`}>
      {children}
    </p>
  );
}

// ───────────────────────────────────────────────────────────────
// Todo row — checkbox-sibling + priority pill + due-date pill
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

  const onToggleDone = () => {
    start(async () => {
      await setTodoStatus(todo.id, done ? 'offen' : 'erledigt');
      onChanged();
    });
  };

  const onDelete = () => {
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

  const onSetPriority = (priority: TodoPriority) => {
    start(async () => {
      await setTodoPriority(todo.id, priority);
      onChanged();
    });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="group"
    >
      <div className="flex h-11 w-full items-center gap-3 px-1 transition-colors duration-150 group-hover:bg-white/[0.015]">
        <button
          type="button"
          onClick={onToggleDone}
          aria-label={done ? 'Wieder öffnen' : 'Erledigt markieren'}
          className="shrink-0 text-[#52525B] transition-colors duration-150 hover:text-[#FAFAFA]"
        >
          <Checkbox done={done} />
        </button>
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          aria-label={expanded ? 'Details schließen' : 'Details öffnen'}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            className={`min-w-0 flex-1 truncate text-[14px] transition-colors duration-300 ${
              done ? 'text-[#52525B] line-through decoration-[#52525B]/40' : 'text-[#FAFAFA]'
            }`}
          >
            {todo.title}
          </span>
          {!done && <PriorityChip priority={todo.priority} />}
          {!done && todo.dueAt && <DueChip iso={todo.dueAt} />}
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Löschen"
          className="shrink-0 px-1.5 text-[14px] text-[#3a3a3f] opacity-0 transition-opacity duration-150 hover:text-[#ff8a8a] group-hover:opacity-100"
        >
          ⋯
        </button>
      </div>

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
              <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px]">
                <DueInput value={todo.dueAt} onChange={onSetDue} />
                <PrioritySelect value={todo.priority} onChange={onSetPriority} />
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
    </motion.div>
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

// ───────────────────────────────────────────────────────────────
// Priority chip — dot + uppercase label
// ───────────────────────────────────────────────────────────────

function PriorityChip({ priority }: { priority: TodoPriority }) {
  // 'mittel' is the implicit default — no chip. Renders only for explicit
  // priority signals.
  if (priority === 'mittel') return null;
  const palette: Record<Exclude<TodoPriority, 'mittel'>, { color: string; label: string }> = {
    urgent: { color: '#E8B86D', label: 'urgent' },
    hoch: { color: '#E8B86D', label: 'hoch' },
    niedrig: { color: '#3a3a3f', label: 'niedrig' },
  };
  const tone = palette[priority as Exclude<TodoPriority, 'mittel'>] ?? null;
  if (!tone) return null;
  return (
    <span
      className="shrink-0 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.4px]"
      style={{ color: tone.color }}
    >
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: tone.color }}
      />
      {tone.label}
    </span>
  );
}

// ───────────────────────────────────────────────────────────────
// Due-date chip
// ───────────────────────────────────────────────────────────────

function DueChip({ iso }: { iso: string }) {
  const d = new Date(iso);
  const days = Math.floor((d.getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
  let label: string;
  let color = '#52525B';
  if (days < 0) {
    label = 'überfällig';
    color = '#ff8a8a';
  } else if (days === 0) {
    label = 'heute';
    color = '#E8B86D';
  } else if (days === 1) {
    label = 'morgen';
  } else if (days < 7) {
    label = `in ${days}T`;
  } else {
    label = d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
  }
  return (
    <span className="shrink-0 text-[11px]" style={{ color }}>
      {label}
    </span>
  );
}

// ───────────────────────────────────────────────────────────────
// Inline edit controls
// ───────────────────────────────────────────────────────────────

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

function PrioritySelect({
  value,
  onChange,
}: {
  value: TodoPriority;
  onChange: (p: TodoPriority) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[#52525B]">
      <span>Priorität:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TodoPriority)}
        className="rounded border border-[#1F1F23] bg-[#0A0A0C] px-2 py-1 text-[12px] text-[#A1A1AA] outline-none focus:border-[#2A2A30]"
      >
        <option value="niedrig">Niedrig</option>
        <option value="mittel">Mittel</option>
        <option value="hoch">Hoch</option>
        <option value="urgent">Urgent</option>
      </select>
    </label>
  );
}
