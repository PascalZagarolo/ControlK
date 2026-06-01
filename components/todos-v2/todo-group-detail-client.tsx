'use client';

/**
 * Group-detail page for /todos/[slug] — the work surface.
 *
 * Dense + functional: rapid multiline capture, status toggle, inline expand
 * for full editing (Titel, Textkörper, Subtasks, Fälligkeit, Uhrzeit,
 * Priorität, Löschen mit Confirm). Plus search over titles and a list
 * view-toggle (kompakt / ausführlich). Writes into the EXISTING todo
 * structure + actions — no parallel store.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  createTodoFromForm,
  setTodoStatus,
  deleteTodo,
  setTodoDue,
  setTodoPriority,
  updateTodoTitle,
  setTodoDescription,
  setTodoScheduledTime,
  addSubtask,
  toggleSubtask,
  deleteSubtask,
} from '@/lib/actions/todos';
import { setTodoGroupParent } from '@/lib/actions/todo-groups';
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
  parentName?: string;
  parentSlug?: string;
};

type Subgroup = { slug: string; name: string; emoji?: string; openCount: number };
type ParentOption = { slug: string; name: string };

type DetailSubtask = { id: string; title: string; done: boolean };

type DetailTodo = {
  id: string;
  title: string;
  status: TodoStatus;
  priority: TodoPriority;
  dueAt: string | null;
  description?: string;
  scheduledTime?: string | null;
  subtasks?: DetailSubtask[];
};

type Stats = { open: number; done: number; dueToday: number };
type ListView = 'kompakt' | 'ausführlich';

const OPEN_HEADER_THRESHOLD = 5; // hide "OFFEN (N)" header below this count

export function TodoGroupDetailClient({
  group,
  openTodos,
  doneTodos,
  stats,
  subgroups = [],
  parentOptions = [],
  canNest = true,
}: {
  group: DetailGroup;
  openTodos: DetailTodo[];
  doneTodos: DetailTodo[];
  stats: Stats;
  subgroups?: Subgroup[];
  parentOptions?: ParentOption[];
  canNest?: boolean;
}) {
  const router = useRouter();
  const [doneOpen, setDoneOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ListView>('kompakt');

  // Title search — case-insensitive over open + done. Empty query = no filter.
  const q = query.trim().toLowerCase();
  const matches = (t: DetailTodo) => !q || t.title.toLowerCase().includes(q);
  const openFiltered = useMemo(() => openTodos.filter(matches), [openTodos, q]);
  const doneFiltered = useMemo(() => doneTodos.filter(matches), [doneTodos, q]);

  const showOpenHeader = openFiltered.length > OPEN_HEADER_THRESHOLD;

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
          <GroupMenu group={group} parentOptions={parentOptions} canNest={canNest} />
        </header>

        {subgroups.length > 0 && (
          <section className="mt-6">
            <SectionLabel className="mb-2">Untergruppen ({subgroups.length})</SectionLabel>
            <ul className="flex flex-col divide-y divide-[#1F1F23] rounded-md border border-[#1F1F23]">
              {subgroups.map((sg) => (
                <li key={sg.slug}>
                  <Link
                    href={`/todos/${sg.slug}`}
                    className="group flex h-11 items-center gap-3 px-3 transition-colors duration-150 hover:bg-white/[0.02]"
                  >
                    <span aria-hidden className="text-[12px] text-[#52525B]">↳</span>
                    <span className="min-w-0 flex-1 truncate text-[14px] text-[#FAFAFA]">
                      {sg.emoji && <span className="mr-1.5">{sg.emoji}</span>}
                      {sg.name}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-[#52525B]">
                      {sg.openCount} offen
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Toolbar — search + view toggle. Only when there's something to act on. */}
        {(openTodos.length > 0 || doneTodos.length > 0) && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <SearchInput value={query} onChange={setQuery} />
            <ViewToggle view={view} onChange={setView} />
          </div>
        )}

        {/* Continuous list: the input is the top row, items below share the
            divide-y separators so input + items feel like one column. */}
        <div className="mt-6 flex flex-col divide-y divide-[#1F1F23]">
          <QuickInput
            groupId={group.id}
            projectId={group.projectId}
            onCreated={() => router.refresh()}
          />

          {showOpenHeader && openFiltered.length > 0 && (
            <SectionLabel className="px-1 pt-4 pb-2">Offen ({openFiltered.length})</SectionLabel>
          )}

          {openFiltered.length > 0 && (
            <AnimatePresence initial={false}>
              {openFiltered.map((todo) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  view={view}
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

        {q && openFiltered.length === 0 && doneFiltered.length === 0 && (openTodos.length > 0 || doneTodos.length > 0) && (
          <p className="mt-6 text-center text-[13px] text-[#52525B]">
            Kein Todo passt zu „{query.trim()}".
          </p>
        )}

        {doneFiltered.length > 0 && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setDoneOpen((v) => !v)}
              className="flex items-center gap-2 text-[12px] text-[#52525B] transition-colors duration-150 hover:text-[#A1A1AA]"
            >
              <span aria-hidden>{doneOpen ? '▾' : '▸'}</span>
              Erledigt ({doneFiltered.length})
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
                  {doneFiltered.map((todo) => (
                    <TodoRow
                      key={todo.id}
                      todo={todo}
                      view="kompakt"
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
// Breadcrumb
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
          <Link href={`/todos?project=${group.projectSlug}`} className="transition-colors duration-150 hover:text-[#A1A1AA]">
            {group.projectName}
          </Link>
        </>
      )}
      {group.parentName && group.parentSlug && (
        <>
          <span aria-hidden className="text-[#3a3a3f]">·</span>
          <Link href={`/todos/${group.parentSlug}`} className="transition-colors duration-150 hover:text-[#A1A1AA]">
            {group.parentName}
          </Link>
        </>
      )}
      <span aria-hidden className="text-[#3a3a3f]">·</span>
      <span className="text-[#FAFAFA]">{group.name}</span>
    </nav>
  );
}

// ───────────────────────────────────────────────────────────────
// Search + view toggle
// ───────────────────────────────────────────────────────────────

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex h-9 min-w-[200px] flex-1 items-center gap-2 rounded-md border border-[#1F1F23] bg-white/[0.015] px-2.5 transition-colors focus-within:border-[#2A2A30]">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-[#52525B]">
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Todos durchsuchen …"
        className="min-w-0 flex-1 bg-transparent text-[13px] text-[#FAFAFA] outline-none placeholder:text-[#52525B]"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Suche leeren" className="shrink-0 text-[13px] text-[#52525B] hover:text-[#A1A1AA]">
          ×
        </button>
      )}
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: ListView; onChange: (v: ListView) => void }) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-0.5 rounded-md border border-[#1F1F23] bg-white/[0.015] p-0.5">
      {(['kompakt', 'ausführlich'] as ListView[]).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`rounded px-2.5 py-1 text-[12px] capitalize transition-colors duration-150 ${
            view === v ? 'bg-white/[0.06] text-[#FAFAFA]' : 'text-[#52525B] hover:text-[#A1A1AA]'
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Group context menu (⋯)
// ───────────────────────────────────────────────────────────────

function GroupMenu({
  group,
  parentOptions,
  canNest,
}: {
  group: DetailGroup;
  parentOptions: ParentOption[];
  canNest: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [, start] = useTransition();

  const moveTo = (parentSlug: string | null) => {
    setOpen(false);
    setMoveOpen(false);
    start(async () => {
      const res = await setTodoGroupParent(group.slug, parentSlug);
      if (!res.ok) {
        alert(res.error);
        return;
      }
      router.refresh();
    });
  };

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setMoveOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setMoveOpen(false);
      }
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
      router.push('/todos');
    });
  };

  const onDelete = () => {
    if (!confirm(`„${group.name}" wirklich löschen? Alle Todos darin gehen verloren.`)) return;
    setOpen(false);
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
        <div role="menu" className="absolute right-0 top-9 z-50 min-w-[200px] rounded-md border border-[#1F1F23] bg-[rgba(20,21,23,0.96)] p-1 backdrop-blur-md">
          {!moveOpen ? (
            <>
              {canNest && parentOptions.length > 0 && (
                <MenuItem label="In Übergruppe verschieben…" onClick={() => setMoveOpen(true)} />
              )}
              {group.parentSlug && <MenuItem label="Aus Übergruppe lösen" onClick={() => moveTo(null)} />}
              <MenuItem label="Archivieren" onClick={onArchive} />
              <MenuItem label="Löschen" tone="danger" onClick={onDelete} />
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMoveOpen(false)}
                className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-[11px] uppercase tracking-[0.4px] text-[#52525B] transition-colors duration-150 hover:text-[#A1A1AA]"
              >
                ‹ Übergruppe wählen
              </button>
              <div className="max-h-[240px] overflow-y-auto">
                {parentOptions
                  .filter((p) => p.slug !== group.parentSlug)
                  .map((p) => (
                    <MenuItem key={p.slug} label={p.name} onClick={() => moveTo(p.slug)} />
                  ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ label, onClick, tone = 'default' }: { label: string; onClick: () => void; tone?: 'default' | 'danger' }) {
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
// Quick input — multiline textarea, auto-grow, refocus after add
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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Auto-grow so multiline input is fully visible, not clipped.
  const grow = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    grow();
  }, [value]);

  const submit = () => {
    // First line = title, the rest = description body (Absätze).
    const lines = value.split('\n');
    const rawTitle = lines[0] ?? '';
    const body = lines.slice(1).join('\n').trim();
    const parsed = parseTodoInput(rawTitle);
    if (!parsed.title) return;
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set('title', parsed.title);
      fd.set('groupId', groupId);
      if (projectId) fd.set('projectId', projectId);
      if (body) fd.set('description', body);
      if (parsed.dueAt) fd.set('dueAt', parsed.dueAt.toISOString());
      const res = await createTodoFromForm(fd);
      if (res.ok) {
        setValue('');
        // Refocus for rapid back-to-back capture.
        requestAnimationFrame(() => inputRef.current?.focus());
        onCreated();
      } else {
        setError(res.error ?? 'Fehler beim Anlegen');
      }
    });
  };

  return (
    <div>
      <div
        className="flex items-start gap-2.5 px-1 py-2.5 transition-colors duration-150"
        style={{ background: focused ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.015)' }}
      >
        <PlusIcon className="mt-1 shrink-0 text-[#52525B]" />
        <textarea
          ref={inputRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            // Enter submits; Shift+Enter inserts a newline (body paragraph).
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Neues Todo … (Shift+⏎ für Absatz)"
          disabled={pending}
          className="flex-1 resize-none bg-transparent text-[14px] leading-[1.5] text-[#FAFAFA] outline-none placeholder:text-[#52525B] disabled:opacity-60"
        />
        <span
          className="mt-1 shrink-0 font-mono text-[10px] uppercase tracking-[0.3px] text-[#52525B] transition-opacity duration-150"
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

function SectionLabel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <p className={`font-mono text-[10.5px] uppercase tracking-[0.5px] text-[#52525B] ${className ?? ''}`}>
      {children}
    </p>
  );
}

// ───────────────────────────────────────────────────────────────
// Todo row — checkbox + title + indicators; expand = full editor
// ───────────────────────────────────────────────────────────────

function TodoRow({
  todo,
  view,
  expanded,
  onToggleExpand,
  onChanged,
}: {
  todo: DetailTodo;
  view: ListView;
  expanded: boolean;
  onToggleExpand: () => void;
  onChanged: () => void;
}) {
  const [, start] = useTransition();
  const done = todo.status === 'erledigt' || todo.status === 'abgebrochen';
  const subtaskTotal = todo.subtasks?.length ?? 0;
  const subtaskDone = todo.subtasks?.filter((s) => s.done).length ?? 0;
  const detailed = view === 'ausführlich' && !done;

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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="group"
    >
      <div className="flex min-h-11 w-full items-center gap-3 px-1 py-1.5 transition-colors duration-150 group-hover:bg-white/[0.015]">
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
          className="flex min-w-0 flex-1 flex-col items-stretch gap-0.5 py-0.5 text-left"
        >
          <span className="flex items-center gap-3">
            <span
              className={`min-w-0 flex-1 truncate text-[14px] transition-colors duration-300 ${
                done ? 'text-[#52525B] line-through decoration-[#52525B]/40' : 'text-[#FAFAFA]'
              }`}
            >
              {todo.title}
            </span>
            {!done && subtaskTotal > 0 && (
              <span className="shrink-0 font-mono text-[10px] text-[#52525B]">
                ☑ {subtaskDone}/{subtaskTotal}
              </span>
            )}
            {!done && <PriorityChip priority={todo.priority} />}
            {!done && todo.scheduledTime && (
              <span className="shrink-0 font-mono text-[10.5px] text-[#52525B]">{todo.scheduledTime}</span>
            )}
            {!done && todo.dueAt && <DueChip iso={todo.dueAt} />}
          </span>
          {/* Ausführlich: show a body preview inline, without expanding. */}
          {detailed && todo.description && (
            <span className="line-clamp-2 whitespace-pre-wrap pr-6 text-[12px] leading-[1.5] text-[#A1A1AA]">
              {todo.description}
            </span>
          )}
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
            <TodoEditor todo={todo} onChanged={onChanged} onDelete={onDelete} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ───────────────────────────────────────────────────────────────
// Inline editor — title, body, subtasks, due, time, priority, delete
// ───────────────────────────────────────────────────────────────

function TodoEditor({
  todo,
  onChanged,
  onDelete,
}: {
  todo: DetailTodo;
  onChanged: () => void;
  onDelete: () => void;
}) {
  const [, start] = useTransition();
  const [title, setTitle] = useState(todo.title);
  const [desc, setDesc] = useState(todo.description ?? '');
  const [newSub, setNewSub] = useState('');

  const saveTitle = () => {
    const next = title.trim();
    if (!next || next === todo.title) return;
    start(async () => {
      await updateTodoTitle(todo.id, next);
      onChanged();
    });
  };

  const saveDesc = () => {
    if ((desc.trim() || '') === (todo.description ?? '')) return;
    start(async () => {
      await setTodoDescription(todo.id, desc);
      onChanged();
    });
  };

  const addSub = () => {
    const t = newSub.trim();
    if (!t) return;
    start(async () => {
      await addSubtask(todo.id, t);
      setNewSub('');
      onChanged();
    });
  };

  const onSetDue = (date: string | null) =>
    start(async () => {
      await setTodoDue(todo.id, date);
      onChanged();
    });

  const onSetTime = (time: string | null) =>
    start(async () => {
      await setTodoScheduledTime(todo.id, time);
      onChanged();
    });

  const onSetPriority = (priority: TodoPriority) =>
    start(async () => {
      await setTodoPriority(todo.id, priority);
      onChanged();
    });

  return (
    <div className="ml-7 mb-3 mt-1 flex flex-col gap-3 rounded-md border border-[#1F1F23] bg-[#0E0E11] p-3">
      {/* Editable title */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={saveTitle}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-full rounded border border-transparent bg-transparent text-[14px] font-medium text-[#FAFAFA] outline-none focus:border-[#2A2A30] focus:bg-[#0A0A0C] focus:px-2 focus:py-1"
        aria-label="Titel bearbeiten"
      />

      {/* Editable body (Absätze / zweite Ebene) */}
      <AutoTextarea
        value={desc}
        onChange={setDesc}
        onBlur={saveDesc}
        placeholder="Notizen, Absätze, Kontext … (optional)"
      />

      {/* Subtasks (Untergruppen) */}
      <div className="flex flex-col gap-1">
        <SectionLabel>Subtasks</SectionLabel>
        {todo.subtasks && todo.subtasks.length > 0 && (
          <ul className="flex flex-col">
            {todo.subtasks.map((st) => (
              <li key={st.id} className="group/sub flex items-center gap-2 py-1">
                <button
                  type="button"
                  onClick={() =>
                    start(async () => {
                      await toggleSubtask(st.id);
                      onChanged();
                    })
                  }
                  aria-label={st.done ? 'Wieder öffnen' : 'Erledigt'}
                  className="shrink-0 text-[#52525B] transition-colors hover:text-[#FAFAFA]"
                >
                  <Checkbox done={st.done} small />
                </button>
                <span className={`min-w-0 flex-1 truncate text-[12.5px] ${st.done ? 'text-[#52525B] line-through decoration-[#52525B]/40' : 'text-[#D4D4D8]'}`}>
                  {st.title}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    start(async () => {
                      await deleteSubtask(st.id);
                      onChanged();
                    })
                  }
                  aria-label="Subtask löschen"
                  className="shrink-0 px-1 text-[12px] text-[#3a3a3f] opacity-0 transition-opacity hover:text-[#ff8a8a] group-hover/sub:opacity-100"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2 py-1">
          <span aria-hidden className="shrink-0 text-[12px] text-[#52525B]">+</span>
          <input
            value={newSub}
            onChange={(e) => setNewSub(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSub();
              }
            }}
            placeholder="Subtask hinzufügen …"
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-[#FAFAFA] outline-none placeholder:text-[#52525B]"
          />
        </div>
      </div>

      {/* Due-date + time + priority controls */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#1F1F23] pt-3 text-[12px]">
        <DueControl value={todo.dueAt} onChange={onSetDue} />
        <TimeControl value={todo.scheduledTime ?? null} onChange={onSetTime} />
        <PrioritySelect value={todo.priority} onChange={onSetPriority} />
        <button type="button" onClick={onDelete} className="ml-auto text-[#52525B] transition-colors hover:text-[#ff8a8a]">
          Löschen
        </button>
      </div>
    </div>
  );
}

function AutoTextarea({
  value,
  onChange,
  onBlur,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 280)}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      className="w-full resize-none rounded border border-[#1F1F23] bg-[#0A0A0C] px-2 py-1.5 text-[12.5px] leading-[1.6] text-[#D4D4D8] outline-none focus:border-[#2A2A30]"
    />
  );
}

function Checkbox({ done, small }: { done: boolean; small?: boolean }) {
  const size = small ? 13 : 16;
  if (done) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="3" fill="currentColor" fillOpacity="0.05" />
        <polyline points="9 12 11 14 15 9" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="3" />
    </svg>
  );
}

function PriorityChip({ priority }: { priority: TodoPriority }) {
  if (priority === 'mittel') return null;
  const palette: Record<Exclude<TodoPriority, 'mittel'>, { color: string; label: string }> = {
    urgent: { color: '#E8B86D', label: 'urgent' },
    hoch: { color: '#E8B86D', label: 'hoch' },
    niedrig: { color: '#3a3a3f', label: 'niedrig' },
  };
  const tone = palette[priority as Exclude<TodoPriority, 'mittel'>] ?? null;
  if (!tone) return null;
  return (
    <span className="shrink-0 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.4px]" style={{ color: tone.color }}>
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: tone.color }} />
      {tone.label}
    </span>
  );
}

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
// Due control — heute / morgen / Datum / kein Datum
// ───────────────────────────────────────────────────────────────

function DueControl({ value, onChange }: { value: string | null; onChange: (date: string | null) => void }) {
  const local = value ? new Date(value).toISOString().slice(0, 10) : '';

  const setRelative = (offsetDays: number) => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offsetDays);
    onChange(d.toISOString());
  };

  const todayActive = (() => {
    if (!value) return false;
    const d = new Date(value);
    const n = new Date();
    return d.toDateString() === n.toDateString();
  })();
  const tomorrowActive = (() => {
    if (!value) return false;
    const d = new Date(value);
    const n = new Date();
    n.setDate(n.getDate() + 1);
    return d.toDateString() === n.toDateString();
  })();

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[#52525B]">
      <span>Fällig:</span>
      <Pill active={todayActive} onClick={() => setRelative(0)}>Heute</Pill>
      <Pill active={tomorrowActive} onClick={() => setRelative(1)}>Morgen</Pill>
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
        aria-label="Datum wählen"
      />
      <Pill active={!value} onClick={() => onChange(null)}>Kein Datum</Pill>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Time control — pure data field "HH:MM" (no calendar coupling)
// ───────────────────────────────────────────────────────────────

function TimeControl({ value, onChange }: { value: string | null; onChange: (time: string | null) => void }) {
  return (
    <label className="flex items-center gap-2 text-[#52525B]">
      <span>Uhrzeit:</span>
      <input
        type="time"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="rounded border border-[#1F1F23] bg-[#0A0A0C] px-2 py-1 text-[12px] text-[#A1A1AA] outline-none focus:border-[#2A2A30]"
        aria-label="Eingeplante Uhrzeit"
      />
      {value && (
        <button type="button" onClick={() => onChange(null)} className="text-[#52525B] hover:text-[#A1A1AA]" aria-label="Uhrzeit entfernen">
          ×
        </button>
      )}
    </label>
  );
}

function PrioritySelect({ value, onChange }: { value: TodoPriority; onChange: (p: TodoPriority) => void }) {
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

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2 py-0.5 text-[11.5px] transition-colors duration-150 ${
        active ? 'bg-white/[0.08] text-[#FAFAFA]' : 'text-[#A1A1AA] hover:bg-white/[0.04] hover:text-[#FAFAFA]'
      }`}
    >
      {children}
    </button>
  );
}
