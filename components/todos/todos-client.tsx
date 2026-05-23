'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Headline, MetaTag, MetaDivider } from '@/components/ui/headline';
import { FilterPills } from '@/components/ui/filter-pills';
import { EmptyCreateCard } from '@/components/ui/empty-create-card';
import { DailyPlanBanner } from './daily-plan-banner';
import { TodoListView } from './todo-list-view';
import { TodoCardView } from './todo-card-view';
import { TodoKanbanView } from './todo-kanban-view';
import { TodoFocusView } from './todo-focus-view';
import { TodoCalendarView } from './todo-calendar-view';
import { TodoDetailDrawer } from './todo-detail-drawer';
import { CreateTodoModal } from './create-todo-modal';
import { TodoSidebar } from './todo-sidebar';
import { CaptureWorkflowModal } from './capture-workflow-modal';
import { ShareGroupModal } from './share-group-modal';
import { getTodo } from '@/lib/actions/todo-fetch';
import { useChannelSubscription } from '@/lib/realtime/pusher-client';
import { ENERGY_META } from './energy-picker';
import type { ShareLink, Todo, TodoEnergy, TodoGroup, TodoUser, Workflow } from '@/lib/types';

const VIEWS = ['Liste', 'Kanban', 'Focus', 'Kalender'] as const;
type View = (typeof VIEWS)[number];

type Scope = 'Alle' | 'Meine' | 'Nicht zugewiesen';
const SCOPE_OPTIONS = ['Alle', 'Meine', 'Nicht zugewiesen'] as const;

type Props = {
  workspaceId: string;
  todos: Todo[];
  groups: TodoGroup[];
  smartCounts: { all: number; mine: number; today: number; overdue: number };
  ungroupedCount: number;
  members: TodoUser[];
  customers: { dbId: string; slug: string; name: string }[];
  contracts: { dbId: string; externalId: string; title: string }[];
  vehicles: { dbId: string; externalId: string; label: string }[];
  channels: { dbId: string; slug: string; name: string }[];
  currentUser: TodoUser;
  activeGroup?: TodoGroup;
  workflows?: Workflow[];
  shareLinks?: ShareLink[];
};

export function TodosClient(props: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const pathname = usePathname();
  const smartView = search.get('view'); // null | 'mine' | 'today' | 'overdue' | 'ungrouped'

  const [view, setView] = useState<View>('Liste');
  const [scope, setScope] = useState<Scope>('Alle');
  const [showDone, setShowDone] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [density, setDensity] = useState<'rows' | 'cards'>('rows');
  const [energyFilter, setEnergyFilter] = useState<TodoEnergy | null>(null);

  // Live updates via Pusher — refresh on any todo event in this workspace.
  useChannelSubscription(`workspace-${props.workspaceId}-todos`, {
    'todo.created': () => router.refresh(),
    'todo.updated': () => router.refresh(),
    'todo.status': () => router.refresh(),
    'todo.assigned': () => router.refresh(),
    'todo.due': () => router.refresh(),
    'todo.priority': () => router.refresh(),
    'todo.commented': () => router.refresh(),
    'todo.snoozed': () => router.refresh(),
    'todo.deleted': () => router.refresh(),
    'todo.energy': () => router.refresh(),
    'todo.estimate': () => router.refresh(),
  });

  const openTodoId = search.get('todo');
  const [drawerTodo, setDrawerTodo] = useState<Todo | null>(null);
  const [, startLoad] = useTransition();

  const openDrawer = (id: string) => {
    const params = new URLSearchParams(search.toString());
    params.set('todo', id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
  const closeDrawer = () => {
    const params = new URLSearchParams(search.toString());
    params.delete('todo');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    setDrawerTodo(null);
  };

  useEffect(() => {
    if (!openTodoId) {
      setDrawerTodo(null);
      return;
    }
    startLoad(async () => {
      const t = await getTodo(openTodoId);
      setDrawerTodo(t);
    });
  }, [openTodoId, props.todos]);

  // Smart view filtering (only applies on /todos, not on a group page)
  const visible = useMemo(() => {
    let list = props.todos;
    if (!props.activeGroup) {
      // Apply smart view from URL when not in a group
      if (smartView === 'mine') {
        list = list.filter((t) => t.assignee?.id === props.currentUser.id);
      } else if (smartView === 'today') {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = start.getTime() + 86_400_000;
        list = list.filter((t) => {
          if (!t.dueAt) return false;
          const ts = new Date(t.dueAt).getTime();
          return ts >= start.getTime() && ts < end;
        });
      } else if (smartView === 'overdue') {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        list = list.filter(
          (t) =>
            t.dueAt &&
            new Date(t.dueAt).getTime() < start.getTime() &&
            (t.status === 'offen' || t.status === 'in_arbeit')
        );
      } else if (smartView === 'ungrouped') {
        list = list.filter((t) => !t.group);
      }
    }
    // Scope (Meine / Nicht zugewiesen) overlay
    if (scope === 'Meine') list = list.filter((t) => t.assignee?.id === props.currentUser.id);
    else if (scope === 'Nicht zugewiesen') list = list.filter((t) => !t.assignee);
    if (energyFilter) list = list.filter((t) => t.energy === energyFilter);
    if (!showDone) list = list.filter((t) => t.status !== 'erledigt' && t.status !== 'abgebrochen');
    return list;
  }, [props.todos, props.activeGroup, props.currentUser.id, smartView, scope, showDone, energyFilter]);

  const headline = useMemo(() => {
    if (props.activeGroup) {
      return {
        kicker: 'Gruppe',
        title: props.activeGroup.emoji
          ? `${props.activeGroup.emoji} ${props.activeGroup.name}`
          : props.activeGroup.name,
        subtitle: `Alles, was zur Gruppe „${props.activeGroup.name}" gehört.`,
      };
    }
    if (smartView === 'mine')
      return {
        kicker: 'Smart-View',
        title: 'Mein Fokus',
        subtitle: 'Was dir zugewiesen ist und noch offen ist.',
      };
    if (smartView === 'today')
      return {
        kicker: 'Smart-View',
        title: 'Heute',
        subtitle: 'Alle Items mit Fälligkeit heute.',
      };
    if (smartView === 'overdue')
      return {
        kicker: 'Smart-View',
        title: 'Überfällig',
        subtitle: 'Was länger liegen geblieben ist, als geplant.',
      };
    if (smartView === 'ungrouped')
      return {
        kicker: 'Smart-View',
        title: 'Ohne Gruppe',
        subtitle: 'Items, die noch in keine Liste einsortiert sind.',
      };
    return {
      kicker: 'Todos',
      title: 'Was zu tun ist.',
      subtitle:
        'Persönliche Tasks, Team-Items und automatisch erkannte Sachen aus Verträgen, Kunden und Flotte.',
    };
  }, [props.activeGroup, smartView]);

  return (
    <div className="mx-auto flex w-full max-w-[1340px] gap-6 px-4 pb-32 pt-28 md:px-6">
      <TodoSidebar
        groups={props.groups}
        counts={props.smartCounts}
        ungroupedCount={props.ungroupedCount}
        workflows={props.workflows}
        members={props.members}
        onCaptureWorkflow={() => setCaptureOpen(true)}
      />

      <div className="min-w-0 flex-1">
        <Headline
          kicker={headline.kicker}
          title={headline.title}
          subtitle={headline.subtitle}
          meta={
            <>
              <MetaTag highlight>
                {props.todos.filter((t) => t.status === 'offen' || t.status === 'in_arbeit').length}{' '}
                offen
              </MetaTag>
              <MetaDivider />
              <MetaTag>
                {
                  props.todos.filter(
                    (t) =>
                      t.assignee?.id === props.currentUser.id &&
                      (t.status === 'offen' || t.status === 'in_arbeit')
                  ).length
                }{' '}
                bei dir
              </MetaTag>
              {props.todos.some((t) => t.autoRuleSlug) && (
                <>
                  <MetaDivider />
                  <MetaTag>{props.todos.filter((t) => t.autoRuleSlug).length} automatisch</MetaTag>
                </>
              )}
            </>
          }
          trailing={
            <div className="flex flex-wrap items-center gap-2">
              <FilterPills options={VIEWS} value={view} onChange={setView} />
              {props.activeGroup && (
                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  title="Public Read-Only Link erzeugen"
                  className="rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[12.5px] font-medium leading-none text-ink-200 transition-colors hover:border-white/[0.18] hover:bg-white/[0.05] hover:text-ink-50"
                >
                  🔗 Teilen
                </button>
              )}
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-[12.5px] font-medium leading-none text-ink-50 transition-colors hover:border-white/[0.18] hover:bg-white/[0.06]"
              >
                + Neues Todo
              </button>
            </div>
          }
        />

        <div className="mt-10">
          <DailyPlanBanner
            todos={props.todos}
            currentUserId={props.currentUser.id}
            firstName={props.currentUser.name.split(' ')[0] ?? props.currentUser.name}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <FilterPills options={SCOPE_OPTIONS} value={scope} onChange={setScope} />

          <div className="ml-1 inline-flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.02] px-1 py-1">
            <span className="px-2 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
              jetzt gut für
            </span>
            {(['deep', 'call', 'admin', 'quick'] as TodoEnergy[]).map((e) => {
              const m = ENERGY_META[e];
              const active = energyFilter === e;
              return (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEnergyFilter(active ? null : e)}
                  title={m.description}
                  className={`flex h-6 items-center gap-1 rounded-full px-2 text-[11.5px] transition-colors ${
                    active ? 'bg-white/[0.08] text-ink-50' : 'text-ink-200 hover:bg-white/[0.04]'
                  }`}
                  style={active ? { boxShadow: `inset 0 0 0 1px ${m.color}55` } : undefined}
                >
                  <span>{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[12.5px] font-medium text-ink-200 transition-colors hover:bg-white/[0.04]">
            <input
              type="checkbox"
              checked={showDone}
              onChange={(e) => setShowDone(e.target.checked)}
              className="h-3 w-3 accent-white"
            />
            Erledigte zeigen
          </label>

          {view === 'Liste' && (
            <div className="inline-flex rounded-full border border-white/[0.06] bg-white/[0.02] p-0.5">
              <button
                type="button"
                onClick={() => setDensity('rows')}
                className={`flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] transition-colors ${
                  density === 'rows' ? 'bg-white/[0.06] text-ink-50' : 'text-ink-300'
                }`}
                title="Kompakte Liste"
              >
                ☰ Liste
              </button>
              <button
                type="button"
                onClick={() => setDensity('cards')}
                className={`flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] transition-colors ${
                  density === 'cards' ? 'bg-white/[0.06] text-ink-50' : 'text-ink-300'
                }`}
                title="Kartenraster"
              >
                ▦ Karten
              </button>
            </div>
          )}

          <span className="ml-auto font-mono text-[10.5px] uppercase tracking-[0.3px] text-ink-300">
            {visible.length} angezeigt
          </span>
        </div>

        <div className="mt-6">
          {props.todos.length === 0 ? (
            <EmptyCreateCard
              title={props.activeGroup ? `Erstes Todo in „${props.activeGroup.name}"` : 'Erstes Todo anlegen'}
              subtitle="Aufgaben, Reminder, Wiedervorlagen — alles an einem Ort."
              onClick={() => setCreateOpen(true)}
            />
          ) : visible.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-white/[0.10] bg-white/[0.01] py-14 text-center text-[14px] text-ink-300">
              Nichts zu sehen — andere Smart-View oder Scope probieren.
            </div>
          ) : view === 'Liste' ? (
            density === 'cards' ? (
              <TodoCardView todos={visible} onOpen={openDrawer} />
            ) : (
              <TodoListView todos={visible} onOpen={openDrawer} />
            )
          ) : view === 'Kanban' ? (
            <TodoKanbanView todos={visible} onOpen={openDrawer} />
          ) : view === 'Focus' ? (
            <TodoFocusView todos={visible} onOpen={openDrawer} />
          ) : (
            <TodoCalendarView todos={visible} onOpen={openDrawer} />
          )}
        </div>
      </div>

      <CreateTodoModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        members={props.members}
        customers={props.customers}
        contracts={props.contracts}
        vehicles={props.vehicles}
        channels={props.channels}
        groups={props.groups}
        defaultGroupId={props.activeGroup?.id}
      />

      {drawerTodo && (
        <TodoDetailDrawer
          todo={drawerTodo}
          members={props.members}
          groups={props.groups}
          onClose={closeDrawer}
        />
      )}

      <CaptureWorkflowModal
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        candidates={props.todos
          .filter((t) => t.status !== 'abgebrochen')
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 30)}
      />

      {props.activeGroup && (
        <ShareGroupModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          group={props.activeGroup}
          existingLinks={props.shareLinks ?? []}
        />
      )}
    </div>
  );
}
