'use client';

/**
 * Todos module overview — the "room" view per the brief.
 *
 * - Module header with stats + "+ Neue Gruppe" inline form
 * - Project filter chips (with inline "+ Projekt" form)
 * - Card grid of groups, each with living-status + 3-item preview
 * - Empty state when no groups
 *
 * Server component (app/todos/page.tsx) fetches data and hands it down.
 * This client wraps interactive bits: inline create forms, navigation.
 */

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { createTodoGroup } from '@/lib/actions/todo-groups';
import { createProject } from '@/lib/actions/projects';
import type { Project } from '@/lib/db/queries/projects';
import type { TodoOverviewGroup } from '@/lib/db/queries/todo-overview';

type Stats = { groups: number; open: number; dueWeek: number };

export function TodosOverviewClient({
  projects,
  groups,
  activeProjectSlug,
  stats,
}: {
  projects: Project[];
  groups: TodoOverviewGroup[];
  activeProjectSlug: string | null;
  stats: Stats;
}) {
  const router = useRouter();
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);

  return (
    <main className="min-h-screen bg-[#0A0A0C] text-[#FAFAFA]">
      <div className="mx-auto w-full max-w-[1280px] px-6 pt-[80px]">
        <ModuleHeader
          stats={stats}
          showCreateGroup={showCreateGroup}
          onToggleCreateGroup={() => setShowCreateGroup((v) => !v)}
        />

        {showCreateGroup && (
          <CreateGroupForm
            projects={projects}
            defaultProjectId={
              activeProjectSlug && activeProjectSlug !== 'workspace'
                ? projects.find((p) => p.slug === activeProjectSlug)?.id ?? null
                : null
            }
            onClose={() => setShowCreateGroup(false)}
            onCreated={(slug) => {
              setShowCreateGroup(false);
              router.push(`/todos/${slug}`);
            }}
          />
        )}

        <ProjectFilter
          projects={projects}
          activeSlug={activeProjectSlug}
          showCreate={showCreateProject}
          onToggleCreate={() => setShowCreateProject((v) => !v)}
        />

        {showCreateProject && (
          <CreateProjectForm
            onClose={() => setShowCreateProject(false)}
            onCreated={() => {
              setShowCreateProject(false);
              router.refresh();
            }}
          />
        )}

        {groups.length === 0 ? (
          <EmptyState onCreate={() => setShowCreateGroup(true)} />
        ) : (
          <GroupGrid groups={groups} />
        )}
      </div>
    </main>
  );
}

// ───────────────────────────────────────────────────────────────
// Module header
// ───────────────────────────────────────────────────────────────

function ModuleHeader({
  stats,
  showCreateGroup,
  onToggleCreateGroup,
}: {
  stats: Stats;
  showCreateGroup: boolean;
  onToggleCreateGroup: () => void;
}) {
  return (
    <header className="flex items-end justify-between gap-4 border-b border-[#1F1F23] pb-5">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.4px] text-[#52525B]">
          Todos
        </p>
        <p className="mt-1 text-[13px] text-[#A1A1AA]">
          {stats.groups} {stats.groups === 1 ? 'Gruppe' : 'Gruppen'} · {stats.open}{' '}
          {stats.open === 1 ? 'offen' : 'offen'} ·{' '}
          {stats.dueWeek}{' '}
          {stats.dueWeek === 1 ? 'fällig heute' : 'fällig diese Woche'}
        </p>
      </div>
      <button
        type="button"
        onClick={onToggleCreateGroup}
        className="inline-flex items-center gap-1.5 rounded-md border border-transparent px-2.5 py-1.5 text-[13px] text-[#A1A1AA] transition-colors duration-150 ease-out hover:text-[#E8B86D]"
      >
        {showCreateGroup ? '× Abbrechen' : '+ Neue Gruppe'}
      </button>
    </header>
  );
}

// ───────────────────────────────────────────────────────────────
// Project filter
// ───────────────────────────────────────────────────────────────

function ProjectFilter({
  projects,
  activeSlug,
  showCreate,
  onToggleCreate,
}: {
  projects: Project[];
  activeSlug: string | null;
  showCreate: boolean;
  onToggleCreate: () => void;
}) {
  const chips: { label: string; slug: string | null }[] = [
    { label: 'Alle', slug: null },
    ...projects.map((p) => ({ label: p.name, slug: p.slug })),
    { label: 'Workspace-weit', slug: 'workspace' },
  ];

  return (
    <nav
      aria-label="Projekte"
      className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]"
    >
      {chips.map((c, i) => {
        const isActive = c.slug === activeSlug || (!c.slug && !activeSlug);
        return (
          <span key={i} className="inline-flex items-center gap-3">
            <Link
              href={c.slug ? `/todos?project=${c.slug}` : '/todos'}
              className={`relative transition-colors duration-150 ease-out ${
                isActive ? 'text-[#FAFAFA]' : 'text-[#52525B] hover:text-[#A1A1AA]'
              }`}
            >
              {c.label}
              {isActive && (
                <span
                  aria-hidden
                  className="absolute -bottom-1 left-0 right-0 h-px bg-[#E8B86D]"
                />
              )}
            </Link>
            {i < chips.length - 1 && (
              <span aria-hidden className="text-[#3a3a3f]">
                ·
              </span>
            )}
          </span>
        );
      })}
      <button
        type="button"
        onClick={onToggleCreate}
        className="ml-3 text-[13px] text-[#52525B] transition-colors duration-150 hover:text-[#E8B86D]"
      >
        {showCreate ? '× Abbrechen' : '+ Projekt'}
      </button>
    </nav>
  );
}

// ───────────────────────────────────────────────────────────────
// Inline forms
// ───────────────────────────────────────────────────────────────

function CreateGroupForm({
  projects,
  defaultProjectId,
  onClose,
  onCreated,
}: {
  projects: Project[];
  defaultProjectId: string | null;
  onClose: () => void;
  onCreated: (slug: string) => void;
}) {
  const [pending, start] = useTransition();
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const fd = new FormData();
          fd.set('name', name);
          if (description) fd.set('description', description);
          if (projectId) fd.set('projectId', projectId);
          const res = await createTodoGroup(fd);
          if (res.ok) onCreated(res.slug);
          else setError(res.error);
        });
      }}
      className="mt-4 overflow-hidden rounded-[8px] border border-[#1F1F23] bg-[#161618] p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Gruppen-Name (z.B. Kundenakquise)"
          required
          className="flex-1 rounded-md border border-[#1F1F23] bg-[#0A0A0C] px-3 py-2 text-[14px] text-[#FAFAFA] outline-none placeholder:text-[#52525B] focus:border-[#2A2A30]"
        />
        <select
          value={projectId ?? ''}
          onChange={(e) => setProjectId(e.target.value || null)}
          className="rounded-md border border-[#1F1F23] bg-[#0A0A0C] px-3 py-2 text-[13px] text-[#A1A1AA] outline-none focus:border-[#2A2A30]"
        >
          <option value="">Workspace-weit</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Kurzbeschreibung (optional)"
        className="mt-3 w-full rounded-md border border-[#1F1F23] bg-[#0A0A0C] px-3 py-2 text-[13px] text-[#A1A1AA] outline-none placeholder:text-[#52525B] focus:border-[#2A2A30]"
      />
      {error && (
        <p className="mt-2 text-[12px] text-[#ff8a8a]">{error}</p>
      )}
      <div className="mt-3 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="text-[12.5px] text-[#52525B] transition-colors duration-150 hover:text-[#A1A1AA]"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="rounded-md bg-[#E8B86D] px-3 py-1.5 text-[12.5px] font-medium leading-none text-black transition-colors duration-150 hover:bg-[#F2C77E] disabled:opacity-40"
        >
          {pending ? 'Lege an…' : 'Gruppe anlegen'}
        </button>
      </div>
    </motion.form>
  );
}

function CreateProjectForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [pending, start] = useTransition();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await createProject({
            name,
            description: description || undefined,
          });
          if (res.ok) onCreated();
          else setError(res.error);
        });
      }}
      className="mt-3 overflow-hidden rounded-[8px] border border-[#1F1F23] bg-[#161618] p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Projekt-Name (z.B. Fleet OS)"
          required
          className="flex-1 rounded-md border border-[#1F1F23] bg-[#0A0A0C] px-3 py-2 text-[14px] text-[#FAFAFA] outline-none placeholder:text-[#52525B] focus:border-[#2A2A30]"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Kurzbeschreibung (optional)"
          className="flex-1 rounded-md border border-[#1F1F23] bg-[#0A0A0C] px-3 py-2 text-[13px] text-[#A1A1AA] outline-none placeholder:text-[#52525B] focus:border-[#2A2A30]"
        />
      </div>
      {error && <p className="mt-2 text-[12px] text-[#ff8a8a]">{error}</p>}
      <div className="mt-3 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="text-[12.5px] text-[#52525B] transition-colors duration-150 hover:text-[#A1A1AA]"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="rounded-md bg-[#E8B86D] px-3 py-1.5 text-[12.5px] font-medium leading-none text-black transition-colors duration-150 hover:bg-[#F2C77E] disabled:opacity-40"
        >
          {pending ? 'Lege an…' : 'Projekt anlegen'}
        </button>
      </div>
    </motion.form>
  );
}

// ───────────────────────────────────────────────────────────────
// Group grid
// ───────────────────────────────────────────────────────────────

function GroupGrid({ groups }: { groups: TodoOverviewGroup[] }) {
  return (
    <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((g, i) => (
        <GroupCard key={g.id} group={g} delaySec={Math.min(i, 6) * 0.04} />
      ))}
    </div>
  );
}

function GroupCard({
  group,
  delaySec,
}: {
  group: TodoOverviewGroup;
  delaySec: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: delaySec, ease: 'easeOut' }}
    >
      <Link
        href={`/todos/${group.slug}`}
        className="group block rounded-[8px] border border-[#1F1F23] bg-[#161618] p-5 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-[#2A2A30] hover:bg-[#1A1A1C]"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.5px] text-[#52525B]">
          {group.projectName ?? 'Workspace'}
        </p>
        <p className="mt-2 text-[18px] font-medium leading-tight text-[#FAFAFA]">
          {group.emoji && <span className="mr-1.5">{group.emoji}</span>}
          {group.name}
        </p>
        <p className="mt-2 text-[13px] text-[#FAFAFA]">
          {group.openCount} {group.openCount === 1 ? 'offen' : 'offen'}
          {group.dueTodayCount > 0 && (
            <>
              {' · '}
              <span className="text-[#E8B86D]">{group.dueTodayCount} fällig heute</span>
            </>
          )}
          {group.dueTodayCount === 0 && group.totalCount > 0 && (
            <span className="text-[#52525B]"> · keine fällig</span>
          )}
        </p>
        <p className="mt-1 text-[12px] italic text-[#52525B]">
          {group.livingStatus}
        </p>

        {group.itemPreview.length > 0 && (
          <>
            <div className="my-4 h-px bg-[#1F1F23]" />
            <ul className="flex flex-col gap-1.5">
              {group.itemPreview.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2 text-[13px]"
                >
                  <Checkbox state={item.status} />
                  <span className="min-w-0 flex-1 truncate text-[#FAFAFA]">
                    {item.title}
                  </span>
                  <span className="shrink-0 text-[12px] text-[#52525B]">
                    {itemMeta(item)}
                  </span>
                </li>
              ))}
              {group.itemPreviewMore > 0 && (
                <li className="mt-1 text-[12px] text-[#52525B]">
                  + {group.itemPreviewMore} weitere
                </li>
              )}
            </ul>
          </>
        )}
      </Link>
    </motion.div>
  );
}

function Checkbox({ state }: { state: TodoOverviewGroup['itemPreview'][number]['status'] }) {
  if (state === 'erledigt') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#52525B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (state === 'in_arbeit') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="12" x2="21" y2="12" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#52525B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  );
}

function itemMeta(item: TodoOverviewGroup['itemPreview'][number]): string {
  if (item.priority === 'urgent') return 'urgent';
  if (item.priority === 'hoch') return 'hoch';
  if (!item.dueAt) return '';
  const days = Math.floor(
    (Date.parse(item.dueAt) - new Date().setHours(0, 0, 0, 0)) / 86_400_000
  );
  if (days < 0) return 'überfällig';
  if (days === 0) return 'fällig';
  if (days === 1) return 'morgen';
  if (days < 7) return `${days}T`;
  return '';
}

// ───────────────────────────────────────────────────────────────
// Empty state
// ───────────────────────────────────────────────────────────────

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mt-24 flex flex-col items-center gap-4 text-center">
      <p className="text-[14px] text-[#A1A1AA]">
        Noch keine Gruppen. Eine erste anlegen?
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="rounded-md border border-[#E8B86D]/40 bg-[#E8B86D]/[0.06] px-4 py-2 text-[13px] font-medium text-[#E8B86D] transition-colors duration-150 hover:bg-[#E8B86D]/[0.12]"
      >
        + Erste Gruppe erstellen
      </button>
      <p className="mt-1 text-[11.5px] text-[#52525B]">
        z.B. Kundenakquise, Q4 Roadmap, Onboarding
      </p>
    </div>
  );
}
