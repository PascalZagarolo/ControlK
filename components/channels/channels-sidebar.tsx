'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus, Hash, Search } from 'lucide-react';
import { CreateChannelModal } from './create-channel-modal';
import type { Channel } from '@/lib/types';

/**
 * 280px-wide channel sidebar — the Slack-style left rail for the
 * Channels module. Shown alongside the channel detail view on every
 * `/channels/[slug]` page.
 *
 * Sorting rule: pinned/unread first (descending by unread count), then
 * alphabetical. Archived channels collapse under a sticky footer label
 * and only expand on click — they're rarely needed but must remain
 * reachable for unarchival.
 *
 * Mentions show as an amber `@` badge with count; non-mention unreads
 * just show a small amber dot. Active channel gets a 1px amber left
 * border + the soft amber background tint used elsewhere in the app.
 */

export type SidebarChannel = {
  id: string;
  slug: string;
  name: string;
  topic?: string;
  unread: number;
  mentionCount?: number;
  archived?: boolean;
};

export function ChannelsSidebar({
  channels,
}: {
  channels: SidebarChannel[];
}) {
  // Derive active slug from the URL so the layout doesn't need to
  // re-fetch and pass it down on every navigation. Pathname shape:
  // /channels/[slug] — anything else (e.g. /channels redirecting)
  // matches no row and the sidebar shows no active state.
  const pathname = usePathname();
  const activeSlug =
    pathname?.startsWith('/channels/')
      ? decodeURIComponent(pathname.slice('/channels/'.length).split('/')[0])
      : null;
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const { active, archived } = useMemo(() => {
    const filtered = query.trim()
      ? channels.filter((c) =>
          c.name.toLowerCase().includes(query.toLowerCase().trim())
        )
      : channels;
    const cmp = (a: SidebarChannel, b: SidebarChannel) => {
      // Unread channels float to the top; within each bucket alphabetical.
      const ua = a.unread > 0 ? 0 : 1;
      const ub = b.unread > 0 ? 0 : 1;
      if (ua !== ub) return ua - ub;
      return a.name.localeCompare(b.name);
    };
    return {
      active: filtered.filter((c) => !c.archived).sort(cmp),
      archived: filtered.filter((c) => c.archived).sort(cmp),
    };
  }, [channels, query]);

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-[#1F1F23] bg-[#0F0F11]">
      <div className="flex items-center justify-between px-3 pt-4 pb-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-[#52525B]">
          Channels
        </span>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          aria-label="Neuer Channel"
          className="flex h-5 w-5 items-center justify-center rounded text-[#71717A] transition-colors hover:bg-white/[0.05] hover:text-[#E8B86D]"
        >
          <Plus size={14} strokeWidth={2} />
        </button>
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search
            size={12}
            strokeWidth={2}
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#52525B]"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Channel suchen …"
            className="w-full rounded-md border border-white/[0.04] bg-white/[0.02] py-1.5 pl-7 pr-2 text-[12px] text-[#E5E5E7] outline-none placeholder:text-[#52525B] focus:border-white/[0.10]"
          />
        </div>
      </div>

      <nav
        aria-label="Channel-Liste"
        className="flex-1 overflow-y-auto px-1.5 pb-3"
      >
        {active.length === 0 && archived.length === 0 ? (
          <p className="px-2 py-3 text-[12px] leading-[1.45] text-[#52525B]">
            {query.trim()
              ? 'Kein Channel passt.'
              : 'Noch keine Channels — erstelle einen.'}
          </p>
        ) : (
          <>
            {active.map((c) => (
              <ChannelRow
                key={c.id}
                channel={c}
                active={c.slug === activeSlug}
              />
            ))}
            {archived.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowArchived((v) => !v)}
                  className="mt-3 flex w-full items-center justify-between rounded-md px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.4px] text-[#52525B] transition-colors hover:bg-white/[0.025] hover:text-[#A1A1AA]"
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
}: {
  channel: SidebarChannel;
  active: boolean;
}) {
  const isUnread = channel.unread > 0;
  const hasMentions = (channel.mentionCount ?? 0) > 0;
  return (
    <Link
      href={`/channels/${channel.slug}`}
      className={`group relative flex h-8 items-center gap-2 rounded-md px-2 text-[13.5px] transition-colors duration-100 ${
        active
          ? 'bg-[rgba(232,184,109,0.08)] text-[#FAFAFA]'
          : channel.archived
            ? 'italic text-[#52525B] hover:bg-white/[0.025] hover:text-[#A1A1AA]'
            : 'text-[#cbcbd0] hover:bg-white/[0.025] hover:text-[#FAFAFA]'
      }`}
    >
      {active && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-1 left-0 w-[2px] rounded-r bg-[#E8B86D]"
        />
      )}
      <Hash
        size={13}
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
  );
}
