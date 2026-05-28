'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { CreateGroupModal } from './create-group-modal';
import { WorkflowsPanel } from './workflows-panel';
import type { TodoGroup, TodoUser, Workflow } from '@/lib/types';

type SmartView = {
  key: 'all' | 'mine' | 'today' | 'overdue' | 'ungrouped';
  label: string;
  href: string;
  count: number;
  dot: string;
};

export function TodoSidebar({
  groups,
  counts,
  ungroupedCount,
  workflows,
  members,
  onCaptureWorkflow,
}: {
  groups: TodoGroup[];
  counts: { all: number; mine: number; today: number; overdue: number };
  ungroupedCount: number;
  workflows?: Workflow[];
  members?: TodoUser[];
  onCaptureWorkflow?: () => void;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const view = params.get('view');
  const [createOpen, setCreateOpen] = useState(false);

  const activeSlug = (() => {
    const m = pathname.match(/^\/todos\/([^/]+)/);
    return m?.[1];
  })();

  // Build a one-level tree from the flat group list: top-level groups, each
  // with its subgroups. Order is preserved from the incoming array.
  const topGroups = groups.filter((g) => !g.parentGroupId);
  const childrenByParent = new Map<string, TodoGroup[]>();
  for (const g of groups) {
    if (g.parentGroupId) {
      const list = childrenByParent.get(g.parentGroupId) ?? [];
      list.push(g);
      childrenByParent.set(g.parentGroupId, list);
    }
  }
  const parentOptions = topGroups.map((g) => ({ id: g.id, name: g.name }));

  const smartViews: SmartView[] = [
    {
      key: 'all',
      label: 'Alle',
      href: '/todos',
      count: counts.all,
      dot: 'bg-ink-300',
    },
    {
      key: 'mine',
      label: 'Mein Fokus',
      href: '/todos?view=mine',
      count: counts.mine,
      dot: 'bg-[#5eb6ff]',
    },
    {
      key: 'today',
      label: 'Heute',
      href: '/todos?view=today',
      count: counts.today,
      dot: 'bg-[#5ee08a]',
    },
    {
      key: 'overdue',
      label: 'Überfällig',
      href: '/todos?view=overdue',
      count: counts.overdue,
      dot: 'bg-[#ff8a8a]',
    },
  ];

  const isSmartActive = (sv: SmartView) => {
    if (activeSlug) return false; // Group page → no smart view active
    if (sv.key === 'all') return !view;
    return view === sv.key;
  };

  return (
    <>
      <aside className="hidden w-[240px] shrink-0 lg:block">
        <div className="sticky top-[88px] flex max-h-[calc(100vh-100px)] flex-col gap-1 overflow-y-auto pr-2">
          <SectionLabel>Smart-Views</SectionLabel>
          <div className="flex flex-col">
            {smartViews.map((sv) => (
              <SidebarItem
                key={sv.key}
                href={sv.href}
                active={isSmartActive(sv)}
                leading={<span className={`inline-block h-1.5 w-1.5 rounded-full ${sv.dot}`} />}
                trailing={
                  sv.count > 0 && (
                    <span className="font-mono text-[10.5px] text-ink-300">{sv.count}</span>
                  )
                }
              >
                {sv.label}
              </SidebarItem>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between pl-2 pr-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
              Gruppen
            </span>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              aria-label="Neue Gruppe"
              className="flex h-5 w-5 items-center justify-center rounded-[4px] text-ink-300 transition-colors hover:bg-white/[0.06] hover:text-ink-50"
              title="Neue Gruppe"
            >
              +
            </button>
          </div>

          <div className="flex flex-col">
            {groups.length === 0 && (
              <p className="px-2 py-2 text-[11.5px] leading-[1.5] text-ink-300">
                Keine Gruppen. Klick auf "+", um deine erste anzulegen — z.B.{' '}
                <span className="text-ink-200">uRent</span>,{' '}
                <span className="text-ink-200">Privat</span>,{' '}
                <span className="text-ink-200">Marketing</span>.
              </p>
            )}
            {topGroups.map((g) => (
              <div key={g.id} className="flex flex-col">
                <SidebarItem
                  href={`/todos/${g.slug}`}
                  active={activeSlug === g.slug}
                  leading={
                    g.emoji ? (
                      <span className="text-[13px] leading-none">{g.emoji}</span>
                    ) : (
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: g.color ?? '#9c9c9d' }}
                      />
                    )
                  }
                  trailing={
                    g.openCount > 0 && (
                      <span className="font-mono text-[10.5px] text-ink-300">{g.openCount}</span>
                    )
                  }
                >
                  {g.name}
                </SidebarItem>
                {/* Subgroups — indented one level under their parent. */}
                {(childrenByParent.get(g.id) ?? []).map((c) => (
                  <SidebarItem
                    key={c.id}
                    href={`/todos/${c.slug}`}
                    active={activeSlug === c.slug}
                    indent
                    leading={
                      c.emoji ? (
                        <span className="text-[12px] leading-none">{c.emoji}</span>
                      ) : (
                        <span className="text-[10px] text-ink-300/70">↳</span>
                      )
                    }
                    trailing={
                      c.openCount > 0 && (
                        <span className="font-mono text-[10.5px] text-ink-300">{c.openCount}</span>
                      )
                    }
                  >
                    {c.name}
                  </SidebarItem>
                ))}
              </div>
            ))}
          </div>

          {ungroupedCount > 0 && (
            <>
              <div className="my-2 h-px bg-white/[0.06]" />
              <SidebarItem
                href="/todos?view=ungrouped"
                active={!activeSlug && view === 'ungrouped'}
                leading={
                  <span className="font-mono text-[10px] text-ink-300/70">∅</span>
                }
                trailing={
                  <span className="font-mono text-[10.5px] text-ink-300">{ungroupedCount}</span>
                }
              >
                Ohne Gruppe
              </SidebarItem>
            </>
          )}

          {workflows && (
            <>
              <div className="my-2 h-px bg-white/[0.06]" />
              <SidebarItem
                href="/todos/brief"
                active={pathname === '/todos/brief'}
                leading={<span className="text-[12px] leading-none">✦</span>}
              >
                Daily Brief
              </SidebarItem>
              <WorkflowsPanel
                workflows={workflows}
                groups={groups}
                members={members ?? []}
                onCaptureRequest={onCaptureWorkflow ?? (() => undefined)}
              />
            </>
          )}
        </div>
      </aside>

      <CreateGroupModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        members={members}
        parentOptions={parentOptions}
      />
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pb-1 pt-1 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
      {children}
    </div>
  );
}

function SidebarItem({
  href,
  active,
  leading,
  trailing,
  indent,
  children,
}: {
  href: string;
  active: boolean;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  indent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-2.5 rounded-[8px] py-1.5 text-[13px] leading-tight transition-colors duration-150 ${
        indent ? 'pl-6 pr-2' : 'px-2'
      } ${
        active
          ? 'bg-white/[0.06] text-ink-50'
          : 'text-ink-200 hover:bg-white/[0.04] hover:text-ink-50'
      }`}
    >
      {leading && <span className="flex h-4 w-4 shrink-0 items-center justify-center">{leading}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </Link>
  );
}
