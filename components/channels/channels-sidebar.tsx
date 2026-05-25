'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, Hash, MoreHorizontal, Plus, Search } from 'lucide-react';
import { CreateChannelModal } from './create-channel-modal';
import {
  assignChannelToGroup,
  createChannelGroup,
} from '@/lib/actions/channels';
import type { ChannelGroup } from '@/lib/types';

export type SidebarChannel = {
  id: string;
  slug: string;
  name: string;
  topic?: string;
  unread: number;
  mentionCount?: number;
  archived?: boolean;
  groupId?: string | null;
};

const COLLAPSED_KEY = 'controlk:channels:collapsed-groups';

export function ChannelsSidebar({
  channels,
  groups,
}: {
  channels: SidebarChannel[];
  groups: ChannelGroup[];
}) {
  const pathname = usePathname();
  const activeSlug =
    pathname?.startsWith('/channels/')
      ? decodeURIComponent(pathname.slice('/channels/'.length).split('/')[0])
      : null;
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Hydrate collapse state from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSED_KEY);
      if (raw) setCollapsed(new Set(JSON.parse(raw)));
    } catch {
      // ignore — localStorage may be disabled
    }
  }, []);
  const persistCollapsed = (next: Set<string>) => {
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
    } catch {
      // ignore
    }
  };
  const toggleGroup = (id: string) => {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    persistCollapsed(next);
  };

  // Sort + filter + bucket by group
  const filtered = useMemo(() => {
    return query.trim()
      ? channels.filter((c) => c.name.toLowerCase().includes(query.toLowerCase().trim()))
      : channels;
  }, [channels, query]);

  const cmp = (a: SidebarChannel, b: SidebarChannel) => {
    const ua = a.unread > 0 ? 0 : 1;
    const ub = b.unread > 0 ? 0 : 1;
    if (ua !== ub) return ua - ub;
    return a.name.localeCompare(b.name);
  };

  const active = filtered.filter((c) => !c.archived);
  const archived = filtered.filter((c) => c.archived).sort(cmp);
  const ungrouped = active.filter((c) => !c.groupId).sort(cmp);
  const byGroup = new Map<string, SidebarChannel[]>();
  for (const c of active) {
    if (!c.groupId) continue;
    const arr = byGroup.get(c.groupId) ?? [];
    arr.push(c);
    byGroup.set(c.groupId, arr);
  }
  for (const arr of byGroup.values()) arr.sort(cmp);

  // Auto-expand the group containing the active channel so it never hides
  const activeChannel = filtered.find((c) => c.slug === activeSlug);
  const effectiveCollapsed = useMemo(() => {
    if (!activeChannel?.groupId) return collapsed;
    if (!collapsed.has(activeChannel.groupId)) return collapsed;
    const next = new Set(collapsed);
    next.delete(activeChannel.groupId);
    return next;
  }, [collapsed, activeChannel]);

  const hasAnything =
    ungrouped.length > 0 || byGroup.size > 0 || archived.length > 0;

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-[#1F1F23] bg-[#0B0B0E]">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#52525B]">
          Channels
        </span>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          aria-label="Neuer Channel"
          className="flex h-5 w-5 items-center justify-center rounded text-[#71717A] transition-colors hover:bg-white/[0.05] hover:text-[#FAFAFA]"
        >
          <Plus size={14} strokeWidth={2} />
        </button>
      </div>

      <div className="px-3 pb-3">
        <div className="relative">
          <Search
            size={12}
            strokeWidth={2}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#52525B]"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen"
            className="w-full rounded-md bg-white/[0.025] py-1.5 pl-7 pr-2 text-[12.5px] text-[#E5E5E7] outline-none placeholder:text-[#52525B] focus:bg-white/[0.04]"
          />
        </div>
      </div>

      <nav
        aria-label="Channel-Liste"
        className="min-h-0 flex-1 overflow-y-auto px-2 pb-4"
      >
        {!hasAnything ? (
          <p className="px-2 py-3 text-[12px] leading-[1.45] text-[#52525B]">
            {query.trim() ? 'Kein Channel passt.' : 'Noch keine Channels — erstelle einen.'}
          </p>
        ) : (
          <>
            {ungrouped.map((c) => (
              <ChannelRow
                key={c.id}
                channel={c}
                active={c.slug === activeSlug}
                groups={groups}
              />
            ))}

            {groups.map((g) => {
              const items = byGroup.get(g.id) ?? [];
              if (items.length === 0 && !query.trim()) {
                // Empty group still rendered so it's reachable for assignment via menu
              }
              const isCollapsed = effectiveCollapsed.has(g.id);
              return (
                <div key={g.id} className="mt-3">
                  <button
                    type="button"
                    onClick={() => toggleGroup(g.id)}
                    aria-expanded={!isCollapsed}
                    className="flex w-full items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[#52525B] transition-colors hover:bg-white/[0.025] hover:text-[#A1A1AA]"
                  >
                    {isCollapsed ? (
                      <ChevronRight size={11} strokeWidth={2.25} />
                    ) : (
                      <ChevronDown size={11} strokeWidth={2.25} />
                    )}
                    <span className="truncate">{g.name}</span>
                    {items.length > 0 && (
                      <span className="ml-auto text-[#3a3a3f]">{items.length}</span>
                    )}
                  </button>
                  {!isCollapsed &&
                    items.map((c) => (
                      <ChannelRow
                        key={c.id}
                        channel={c}
                        active={c.slug === activeSlug}
                        groups={groups}
                      />
                    ))}
                </div>
              );
            })}

            {archived.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowArchived((v) => !v)}
                  className="mt-4 flex w-full items-center justify-between rounded-md px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[#52525B] transition-colors hover:bg-white/[0.025] hover:text-[#A1A1AA]"
                >
                  <span>Archiviert · {archived.length}</span>
                  <span aria-hidden>{showArchived ? '−' : '+'}</span>
                </button>
                {showArchived &&
                  archived.map((c) => (
                    <ChannelRow
                      key={c.id}
                      channel={c}
                      active={c.slug === activeSlug}
                      groups={groups}
                    />
                  ))}
              </>
            )}
          </>
        )}
      </nav>

      <CreateChannelModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </aside>
  );
}

function ChannelRow({
  channel,
  active,
  groups,
}: {
  channel: SidebarChannel;
  active: boolean;
  groups: ChannelGroup[];
}) {
  const isUnread = channel.unread > 0;
  const hasMentions = (channel.mentionCount ?? 0) > 0;

  return (
    <div
      className={`group relative flex h-7 items-center rounded-md text-[13px] transition-colors duration-100 ${
        active
          ? 'bg-white/[0.05] text-[#FAFAFA]'
          : channel.archived
            ? 'italic text-[#52525B] hover:bg-white/[0.025] hover:text-[#A1A1AA]'
            : 'text-[#A1A1AA] hover:bg-white/[0.025] hover:text-[#FAFAFA]'
      }`}
    >
      {active && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-1 left-0 w-[2px] rounded-r bg-[#E8B86D]"
        />
      )}
      <Link
        href={`/channels/${channel.slug}`}
        className="flex min-w-0 flex-1 items-center gap-2 px-2"
      >
        <Hash
          size={12}
          strokeWidth={2}
          className={
            active
              ? 'shrink-0 text-[#A1A1AA]'
              : 'shrink-0 text-[#52525B] group-hover:text-[#71717A]'
          }
        />
        <span
          className={`min-w-0 flex-1 truncate ${
            isUnread && !active ? 'font-medium text-[#FAFAFA]' : ''
          }`}
        >
          {channel.name}
        </span>
        {hasMentions ? (
          <span
            aria-label={`${channel.mentionCount} Mention${
              channel.mentionCount! > 1 ? 's' : ''
            }`}
            className="shrink-0 rounded bg-[rgba(232,184,109,0.16)] px-1.5 py-0.5 font-mono text-[10px] leading-none text-[#E8B86D]"
          >
            @{channel.mentionCount}
          </span>
        ) : isUnread ? (
          <span
            aria-label="Ungelesen"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#E8B86D]"
          />
        ) : null}
      </Link>
      <RowMenu channel={channel} groups={groups} />
    </div>
  );
}

function RowMenu({
  channel,
  groups,
}: {
  channel: SidebarChannel;
  groups: ChannelGroup[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreatingGroup(false);
        setNewGroupName('');
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setCreatingGroup(false);
        setNewGroupName('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (creatingGroup) inputRef.current?.focus();
  }, [creatingGroup]);

  const assignTo = (groupId: string | null) => {
    start(async () => {
      await assignChannelToGroup({ channelId: channel.id, groupId });
      setOpen(false);
      router.refresh();
    });
  };

  const createAndAssign = () => {
    const name = newGroupName.trim();
    if (!name) return;
    start(async () => {
      const res = await createChannelGroup({ name, channelId: channel.id });
      if (res.ok) {
        setOpen(false);
        setCreatingGroup(false);
        setNewGroupName('');
        router.refresh();
      }
    });
  };

  return (
    <div ref={ref} className="relative shrink-0 pr-1">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Channel-Aktionen"
        aria-expanded={open}
        className={`flex h-5 w-5 items-center justify-center rounded text-[#52525B] transition-colors hover:bg-white/[0.05] hover:text-[#FAFAFA] ${
          open ? 'bg-white/[0.05] text-[#FAFAFA] opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <MoreHorizontal size={13} strokeWidth={2} />
      </button>

      {open && (
        <div className="absolute right-1 top-6 z-30 w-52 overflow-hidden rounded-md border border-[#1F1F23] bg-[#161618] py-1 shadow-[0_4px_12px_rgba(0,0,0,0.4)]">
          <p className="px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[#52525B]">
            In Gruppe verschieben
          </p>
          {groups.length === 0 && !creatingGroup && (
            <p className="px-3 pb-1.5 text-[12px] italic text-[#52525B]">
              Noch keine Gruppen.
            </p>
          )}
          {groups.map((g) => {
            const isCurrent = channel.groupId === g.id;
            return (
              <button
                key={g.id}
                type="button"
                disabled={pending || isCurrent}
                onClick={() => assignTo(g.id)}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[12.5px] transition-colors ${
                  isCurrent
                    ? 'text-[#E8B86D]'
                    : 'text-[#E5E5E7] hover:bg-white/[0.04]'
                } disabled:cursor-not-allowed`}
              >
                <span className="truncate">{g.name}</span>
                {isCurrent && <span className="font-mono text-[10px]">✓</span>}
              </button>
            );
          })}

          {channel.groupId && (
            <button
              type="button"
              disabled={pending}
              onClick={() => assignTo(null)}
              className="flex w-full items-center px-3 py-1.5 text-left text-[12.5px] text-[#A1A1AA] transition-colors hover:bg-white/[0.04] hover:text-[#FAFAFA] disabled:opacity-40"
            >
              Aus Gruppe entfernen
            </button>
          )}

          <div className="my-1 h-px bg-[#1F1F23]" />

          {creatingGroup ? (
            <div className="px-2 pb-2 pt-1">
              <input
                ref={inputRef}
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    createAndAssign();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setCreatingGroup(false);
                    setNewGroupName('');
                  }
                }}
                placeholder="z.B. Akquise"
                maxLength={40}
                className="w-full rounded-sm bg-white/[0.04] px-2 py-1 text-[12.5px] text-[#FAFAFA] outline-none placeholder:text-[#52525B] focus:bg-white/[0.06]"
              />
              <div className="mt-1.5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreatingGroup(false);
                    setNewGroupName('');
                  }}
                  className="text-[11px] text-[#71717A] hover:text-[#A1A1AA]"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  disabled={!newGroupName.trim() || pending}
                  onClick={createAndAssign}
                  className="rounded bg-[#E8B86D] px-2 py-0.5 text-[11px] font-medium text-[#0E0E11] transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {pending ? '…' : 'Anlegen'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreatingGroup(true)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-[#A1A1AA] transition-colors hover:bg-white/[0.04] hover:text-[#FAFAFA]"
            >
              <Plus size={12} strokeWidth={2} />
              <span>Neue Gruppe</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
