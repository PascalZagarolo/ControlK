'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Headline, MetaTag, MetaDivider } from '@/components/ui/headline';
import { FilterPills } from '@/components/ui/filter-pills';
import { Avatar } from '@/components/channel/avatar';
import { formatRelativeTime } from '@/lib/time';
import { markAllNotificationsRead, markNotificationRead } from '@/lib/actions/notifications';
import type { Notification, NotificationKind } from '@/lib/types';

const FILTERS = ['Alle', 'Mentions', 'Threads', 'DMs', 'Deals', 'System'] as const;
type Filter = (typeof FILTERS)[number];

const KIND_FILTER: Record<Exclude<Filter, 'Alle'>, NotificationKind[]> = {
  Mentions: ['mention'],
  Threads: ['thread_reply'],
  DMs: ['dm'],
  Deals: ['deal'],
  System: ['system', 'task'],
};

const KIND_ICON: Record<NotificationKind, string> = {
  mention: '@',
  thread_reply: '↳',
  dm: '✉',
  system: '⌘',
  deal: '◆',
  task: '⏱',
};

const KIND_LABEL: Record<NotificationKind, string> = {
  mention: 'Mention',
  thread_reply: 'Thread',
  dm: 'DM',
  system: 'System',
  deal: 'Deal',
  task: 'Task',
};

export function InboxClient({ initial }: { initial: Notification[] }) {
  const [filter, setFilter] = useState<Filter>('Alle');
  const [items, setItems] = useState<Notification[]>(initial);

  const filtered = useMemo(() => {
    if (filter === 'Alle') return items;
    const kinds = KIND_FILTER[filter];
    return items.filter((n) => kinds.includes(n.kind));
  }, [filter, items]);

  const unread = items.filter((n) => !n.read).length;

  const onMarkAll = async () => {
    setItems((items) => items.map((n) => ({ ...n, read: true })));
    await markAllNotificationsRead().catch(() => {});
  };

  const onMarkOne = async (id: string) => {
    setItems((items) => items.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await markNotificationRead(id).catch(() => {});
  };

  return (
    <div className="mx-auto w-full max-w-[820px] px-6 pb-32 pt-28">
      <Headline
        kicker="Inbox"
        title="Posteingang"
        subtitle="Mentions, Thread-Replies, DMs, Deal-Updates und System-Hinweise — auf einem Schirm."
        meta={
          <>
            <MetaTag highlight>{unread} ungelesen</MetaTag>
            <MetaDivider />
            <MetaTag>{items.length} insgesamt</MetaTag>
            <MetaDivider />
            <button
              type="button"
              onClick={onMarkAll}
              disabled={unread === 0}
              className={`font-mono text-[11px] uppercase tracking-[0.3px] transition-colors ${
                unread > 0 ? 'text-ink-200 hover:text-ink-50' : 'cursor-default text-ink-300/40'
              }`}
            >
              Alle als gelesen markieren
            </button>
          </>
        }
        trailing={<FilterPills options={FILTERS} value={filter} onChange={setFilter} />}
      />

      <ul className="mt-10 flex flex-col gap-1">
        {filtered.map((n) => (
          <li key={n.id}>
            <InboxRow n={n} onRead={() => onMarkOne(n.id)} />
          </li>
        ))}
      </ul>

      {filtered.length === 0 && (
        <div className="mt-12 text-center text-[14px] text-ink-300">Keine Treffer.</div>
      )}
    </div>
  );
}

function InboxRow({ n, onRead }: { n: Notification; onRead: () => void }) {
  return (
    <Link
      href={n.sourceUrl}
      onClick={onRead}
      className={`group flex items-start gap-3 rounded-[10px] border border-transparent px-4 py-3 transition-colors duration-150 hover:border-white/[0.08] hover:bg-white/[0.04] ${
        !n.read ? 'bg-white/[0.02]' : ''
      }`}
    >
      <div className="pt-0.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.03] font-mono text-[14px] text-ink-200">
          {KIND_ICON[n.kind]}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
            {KIND_LABEL[n.kind]}
          </span>
          {!n.read && <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#5eb6ff]" />}
        </div>
        <div
          className={`mt-1 text-[14px] font-medium leading-tight ${
            n.read ? 'text-ink-200' : 'text-ink-50'
          }`}
        >
          {n.title}
        </div>
        {n.excerpt && (
          <p className="mt-1 line-clamp-2 text-[12.5px] leading-[1.5] text-ink-300">{n.excerpt}</p>
        )}
      </div>

      <span className="shrink-0 pt-0.5 font-mono text-[10.5px] uppercase tracking-[0.3px] text-ink-300">
        {formatRelativeTime(n.timestamp)}
      </span>
    </Link>
  );
}
