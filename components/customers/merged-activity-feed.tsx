'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/channel/avatar';
import type { MergedActivityEntry, MergedActivityKind } from '@/lib/types';

const KIND_META: Record<
  MergedActivityKind,
  { icon: string; color: string; label: string }
> = {
  message: { icon: '💬', color: '#5eb6ff', label: 'Channel' },
  contract_created: { icon: '§', color: '#9c9c9d', label: 'Vertrag' },
  contract_started: { icon: '§', color: '#5ee08a', label: 'Vertrag aktiv' },
  contract_ended: { icon: '§', color: '#ffd96a', label: 'Vertrag aus' },
  contract_storniert: { icon: '§', color: '#ff8a8a', label: 'Storniert' },
  todo_created: { icon: '◯', color: '#9c9c9d', label: 'Todo' },
  todo_completed: { icon: '✓', color: '#5ee08a', label: 'Todo done' },
  calendar_event: { icon: '◐', color: '#c084fc', label: 'Termin' },
  note: { icon: '✎', color: '#ffb45e', label: 'Notiz' },
  system: { icon: '·', color: '#7d7d7d', label: 'System' },
};

const FILTERS = [
  { key: 'all', label: 'Alle' },
  { key: 'message', label: 'Channels' },
  { key: 'contract', label: 'Verträge' },
  { key: 'todo', label: 'Todos' },
  { key: 'calendar', label: 'Termine' },
] as const;

function matchesFilter(entry: MergedActivityEntry, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'message') return entry.kind === 'message';
  if (filter === 'contract') return entry.kind.startsWith('contract');
  if (filter === 'todo') return entry.kind.startsWith('todo');
  if (filter === 'calendar') return entry.kind === 'calendar_event';
  return true;
}

function relative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'jetzt';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
}

export function MergedActivityFeed({
  entries,
  compact,
}: {
  entries: MergedActivityEntry[];
  compact?: boolean;
}) {
  const [filter, setFilter] = useState<string>('all');
  const visible = entries.filter((e) => matchesFilter(e, filter));

  return (
    <div className="flex flex-col gap-3">
      {!compact && (
        <div className="flex flex-wrap items-center gap-1">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-full border px-2.5 py-1 text-[11.5px] transition-colors ${
                  active
                    ? 'border-white/15 bg-white/[0.08] text-ink-50'
                    : 'border-white/[0.06] bg-white/[0.02] text-ink-300 hover:border-white/[0.14] hover:text-ink-50'
                }`}
              >
                {f.label}
              </button>
            );
          })}
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
            {visible.length} Einträge
          </span>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-white/[0.08] bg-white/[0.01] py-6 text-center text-[12px] text-ink-300">
          Keine Aktivität.
        </div>
      ) : (
        <ol className="flex flex-col">
          {visible.map((e, i) => {
            const meta = KIND_META[e.kind];
            return (
              <li key={e.id} className="relative flex gap-3 pl-3">
                <span
                  className="absolute left-0 top-2 inline-block h-2 w-2 rounded-full"
                  style={{ background: meta.color }}
                />
                {i < visible.length - 1 && (
                  <span className="absolute left-[3.5px] top-3 bottom-0 w-px bg-white/[0.06]" />
                )}
                <div className="min-w-0 flex-1 pb-3">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.3px]" style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
                      {relative(e.occurredAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 flex items-center gap-2 text-[13px] text-ink-50">
                    {e.actor && (
                      <Avatar
                        initials={e.actor.initials}
                        from={e.actor.from}
                        to={e.actor.to}
                        size={18}
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate">{e.title}</span>
                    {e.link && (
                      <Link
                        href={e.link.href}
                        className="shrink-0 font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300 hover:text-ink-50"
                      >
                        {e.link.label} →
                      </Link>
                    )}
                  </p>
                  {e.detail && (
                    <p className="mt-1 line-clamp-2 text-[12px] leading-[1.5] text-ink-300">
                      {e.detail}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
