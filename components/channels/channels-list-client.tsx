'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Headline, MetaTag, MetaDivider } from '@/components/ui/headline';
import { FilterPills } from '@/components/ui/filter-pills';
import { EmptyCreateCard } from '@/components/ui/empty-create-card';
import { Avatar } from '@/components/channel/avatar';
import { CreateChannelModal } from './create-channel-modal';
import { ChannelSearchModal } from '@/components/channel/search-modal';
import { SnippetsModal } from '@/components/channel/snippets-modal';
import type { Channel, ChannelKind, ChannelSnippet } from '@/lib/types';

const FILTERS = ['Alle', 'Ungelesen', 'Mein', 'Customer', 'Deal', 'Damage'] as const;
type Filter = (typeof FILTERS)[number];

const KIND_META: Record<ChannelKind, { label: string; color: string }> = {
  general: { label: 'General', color: '#9c9c9d' },
  customer: { label: 'Kunde', color: '#5eb6ff' },
  deal: { label: 'Deal', color: '#ffd96a' },
  damage: { label: 'Schaden', color: '#ff8a8a' },
  onboarding: { label: 'Onboarding', color: '#5ee08a' },
  announcement: { label: 'News', color: '#c084fc' },
};

export function ChannelsListClient({
  channels,
  unreadByChannel,
  myChannelIds,
  snippets,
}: {
  channels: Channel[];
  unreadByChannel: Record<string, number>;
  myChannelIds: string[];
  snippets: ChannelSnippet[];
}) {
  const [filter, setFilter] = useState<Filter>('Alle');
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [snippetsOpen, setSnippetsOpen] = useState(false);

  const visible = useMemo(() => {
    let list = channels;
    if (filter === 'Ungelesen')
      list = list.filter((c) => (unreadByChannel[c.id ?? ''] ?? 0) > 0);
    else if (filter === 'Mein') list = list.filter((c) => myChannelIds.includes(c.id ?? ''));
    else if (filter === 'Customer') list = list.filter((c) => c.kind === 'customer');
    else if (filter === 'Deal') list = list.filter((c) => c.kind === 'deal');
    else if (filter === 'Damage') list = list.filter((c) => c.kind === 'damage');

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.topic?.toLowerCase().includes(q) ||
          c.linkedCustomer?.name.toLowerCase().includes(q)
      );
    }
    return list.slice().sort((a, b) => {
      const ua = unreadByChannel[a.id ?? ''] ?? 0;
      const ub = unreadByChannel[b.id ?? ''] ?? 0;
      if (ua !== ub) return ub - ua;
      const la = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const lb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return lb - la;
    });
  }, [channels, filter, query, unreadByChannel, myChannelIds]);

  const totalUnread = Object.values(unreadByChannel).reduce((a, b) => a + b, 0);

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 pb-32 pt-28 md:px-6">
      <Headline
        kicker="Channels"
        title="Slack meets CRM."
        subtitle="Jeder Channel ist ein Customer-War-Room mit Live-CRM-Daten, Reactions als Auto-Triggers und Auto-Link-Detection."
        meta={
          <>
            <MetaTag highlight>{channels.length} aktiv</MetaTag>
            {totalUnread > 0 && (
              <>
                <MetaDivider />
                <MetaTag>{totalUnread} ungelesen</MetaTag>
              </>
            )}
          </>
        }
        trailing={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-ink-200 hover:bg-white/[0.05] hover:text-ink-50"
            >
              🔍 Cross-Channel <span className="font-mono text-[10px] text-ink-300">⌘K</span>
            </button>
            <button
              type="button"
              onClick={() => setSnippetsOpen(true)}
              className="rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-ink-200 hover:bg-white/[0.05] hover:text-ink-50"
            >
              💬 Snippets
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-[12.5px] font-medium leading-none text-ink-50 hover:border-white/[0.18] hover:bg-white/[0.06]"
            >
              + Neuer Channel
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <FilterPills options={FILTERS} value={filter} onChange={setFilter} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Channel-Name, Topic, Customer …"
          className="min-w-[220px] flex-1 rounded-full border border-white/[0.06] bg-white/[0.02] px-3.5 py-1.5 text-[12.5px] text-ink-50 outline-none placeholder:text-ink-300 focus:border-white/[0.18]"
        />
        <span className="font-mono text-[10.5px] uppercase tracking-[0.3px] text-ink-300">
          {visible.length} sichtbar
        </span>
      </div>

      {channels.length === 0 ? (
        <EmptyCreateCard
          title="Ersten Channel erstellen"
          subtitle="Sales-Channel pro Kunde, Wartungs-Channel pro Fahrzeug, oder ein allgemeiner Team-Channel."
          onClick={() => setCreateOpen(true)}
        />
      ) : visible.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-white/[0.10] bg-white/[0.01] py-14 text-center text-[14px] text-ink-300">
          Nichts gefunden — anderen Filter oder Suchbegriff probieren.
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((c) => (
            <ChannelCard
              key={c.slug}
              channel={c}
              unread={unreadByChannel[c.id ?? ''] ?? 0}
            />
          ))}
        </div>
      )}

      <CreateChannelModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <ChannelSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <SnippetsModal
        open={snippetsOpen}
        onClose={() => setSnippetsOpen(false)}
        snippets={snippets}
      />
    </div>
  );
}

function ChannelCard({ channel, unread }: { channel: Channel; unread: number }) {
  const meta = channel.kind ? KIND_META[channel.kind] : KIND_META.general;
  return (
    <Link
      href={`/channels/${channel.slug}`}
      className="group relative flex flex-col gap-3 overflow-hidden rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
        style={{
          background: `linear-gradient(90deg, ${meta.color} 0%, ${meta.color}55 60%, transparent 100%)`,
        }}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-1.5">
            <span className="font-mono text-[13px] text-ink-300">#</span>
            <span className="truncate text-[14.5px] font-medium text-ink-50">{channel.name}</span>
          </p>
          {channel.topic && (
            <p className="mt-1 line-clamp-2 text-[11.5px] leading-[1.45] text-ink-300">
              {channel.topic}
            </p>
          )}
        </div>
        {unread > 0 && (
          <span className="rounded-full bg-[#5eb6ff] px-1.5 py-0.5 font-mono text-[10px] tabular-nums leading-none text-black">
            {unread}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span
          className="inline-flex h-5 items-center gap-1 rounded-full px-2 font-mono text-[10px] uppercase tracking-[0.3px]"
          style={{ background: `${meta.color}1f`, color: meta.color }}
        >
          {meta.label}
        </span>
        {channel.dealStage && (
          <span className="inline-flex h-5 items-center gap-1 rounded-full bg-white/[0.04] px-2 font-mono text-[10px] uppercase tracking-[0.3px] text-ink-200">
            {channel.dealStage}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex -space-x-2">
          {channel.membersPreview.slice(0, 4).map((m, i) => (
            <span key={i} className="rounded-full ring-2 ring-ink-900">
              <Avatar initials={m.initials} from={m.from} to={m.to} size={20} />
            </span>
          ))}
        </div>
        <span className="font-mono text-[10px] text-ink-300">
          {channel.members} Mitglieder
        </span>
      </div>

      {channel.lastMessageAt && (
        <p className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
          Aktiv {relative(channel.lastMessageAt)}
        </p>
      )}
    </Link>
  );
}

function relative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'gerade eben';
  if (m < 60) return `vor ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h}h`;
  const d = Math.floor(h / 24);
  return `vor ${d}d`;
}
