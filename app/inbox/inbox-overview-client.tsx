'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type {
  InboxFilter,
  InboxGroup,
  InboxOverviewPage,
  InboxOverviewRow,
} from '@/lib/db/queries/inbox-overview';

export function InboxOverviewClient({
  mode,
  filter,
  gmailConnected,
  pageData,
  groups,
}: {
  mode: 'list' | 'group';
  filter: InboxFilter;
  gmailConnected: boolean;
  pageData: InboxOverviewPage | null;
  groups: InboxGroup[] | null;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  // URL is the source of truth — we never mutate state locally for
  // mode/filter/page. The Server Component re-renders with fresh data
  // on every change.
  const setQuery = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(sp.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    router.push(`/inbox?${params.toString()}`);
  };

  const total =
    mode === 'list'
      ? pageData?.total ?? 0
      : groups?.reduce((sum, g) => sum + g.totalCount, 0) ?? 0;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-32 pt-24 md:px-6">
      {/* Module header */}
      <header className="flex flex-col gap-6 pb-6">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[#52525B]">
              Inbox
            </span>
            <p className="text-[13px] text-[#A1A1AA]">
              {total} {total === 1 ? 'Nachricht' : 'Nachrichten'}
              {filter === 'unread' && ' ungelesen'}
              {filter === 'archived' && ' archiviert'}
            </p>
          </div>
          {!gmailConnected && (
            <Link
              href="/settings/integrations"
              className="rounded-md border border-[#E8B86D]/30 bg-[#E8B86D]/[0.06] px-3 py-1.5 text-[12px] text-[#E8B86D] transition-colors hover:bg-[#E8B86D]/[0.12]"
            >
              Mit Gmail verbinden →
            </Link>
          )}
        </div>

        {/* Filter row + view toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.04] pt-4">
          <nav className="flex items-center gap-1" aria-label="Filter">
            <FilterChip
              label="Ungelesen"
              active={filter === 'unread'}
              onClick={() => setQuery({ filter: 'unread', p: null })}
            />
            <FilterChip
              label="Alle"
              active={filter === 'all'}
              onClick={() => setQuery({ filter: 'all', p: null })}
            />
            <FilterChip
              label="Archiviert"
              active={filter === 'archived'}
              onClick={() => setQuery({ filter: 'archived', p: null })}
              dim
            />
          </nav>
          <ViewToggle
            mode={mode}
            onChange={(next) => setQuery({ mode: next, p: null })}
          />
        </div>
      </header>

      {/* Content */}
      {mode === 'list' && pageData && <ListView page={pageData} setQuery={setQuery} />}
      {mode === 'group' && groups && <GroupedView groups={groups} />}
    </div>
  );
}

function FilterChip({
  label,
  active,
  dim,
  onClick,
}: {
  label: string;
  active: boolean;
  dim?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[12.5px] transition-colors duration-150 ${
        active
          ? 'bg-white/[0.06] text-[#FAFAFA]'
          : dim
            ? 'text-[#71717A] hover:bg-white/[0.03] hover:text-[#A1A1AA]'
            : 'text-[#A1A1AA] hover:bg-white/[0.04] hover:text-[#FAFAFA]'
      }`}
    >
      {label}
    </button>
  );
}

function ViewToggle({
  mode,
  onChange,
}: {
  mode: 'list' | 'group';
  onChange: (next: 'list' | 'group') => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-white/[0.06] bg-white/[0.02] p-0.5">
      {(['list', 'group'] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors ${
            mode === m
              ? 'bg-white/[0.08] text-[#FAFAFA]'
              : 'text-[#A1A1AA] hover:text-[#FAFAFA]'
          }`}
        >
          {m === 'list' ? 'Chronologisch' : 'Nach Kunde'}
        </button>
      ))}
    </div>
  );
}

// ── List mode ────────────────────────────────────────────────────

function ListView({
  page,
  setQuery,
}: {
  page: InboxOverviewPage;
  setQuery: (patch: Record<string, string | null>) => void;
}) {
  if (page.rows.length === 0) {
    return <EmptyState filter={page.filter} />;
  }
  const totalPages = Math.max(1, Math.ceil(page.total / page.pageSize));
  return (
    <>
      <ul className="flex flex-col">
        {page.rows.map((row, i) => (
          <li
            key={row.id}
            className={i === 0 ? '' : 'border-t border-white/[0.04]'}
          >
            <Row row={row} />
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <Pagination
          page={page.page}
          totalPages={totalPages}
          onChange={(p) => setQuery({ p: String(p) })}
        />
      )}
    </>
  );
}

function Row({ row }: { row: InboxOverviewRow }) {
  return (
    <Link
      href={`/inbox/${row.id}`}
      className="grid grid-cols-[180px_1fr_72px] items-baseline gap-4 px-1 py-3 transition-colors duration-150 hover:bg-white/[0.025]"
    >
      <div className="min-w-0">
        <p
          className={`truncate text-[13.5px] leading-tight ${
            row.isRead ? 'text-ink-200' : 'font-medium text-ink-50'
          }`}
        >
          {cleanName(row.senderName)}
        </p>
        {!row.isRead && (
          <span
            aria-hidden
            className="mt-1 inline-block h-1 w-1 rounded-full"
            style={{ background: '#E8B86D' }}
          />
        )}
      </div>
      <div className="min-w-0">
        <p
          className={`truncate text-[13.5px] leading-tight ${
            row.isRead ? 'text-ink-200' : 'text-ink-50'
          }`}
        >
          {row.subject || '(kein Betreff)'}
        </p>
        {row.preview && (
          <p className="mt-0.5 truncate text-[12px] leading-tight text-[#71717A]">
            {row.preview}
          </p>
        )}
      </div>
      <span className="justify-self-end font-mono text-[10.5px] uppercase tracking-[0.06em] text-[#52525B]">
        {formatRel(row.receivedAt)}
      </span>
    </Link>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="mt-8 flex items-center justify-between border-t border-white/[0.04] pt-4">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-[#52525B]">
        Seite {page} von {totalPages}
      </span>
      <div className="flex items-center gap-1.5">
        <PageBtn
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          label="← Zurück"
        />
        <PageBtn
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          label="Weiter →"
        />
      </div>
    </div>
  );
}

function PageBtn({
  disabled,
  onClick,
  label,
}: {
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[12px] text-ink-200 transition-colors hover:border-white/[0.16] hover:text-ink-50 disabled:opacity-40"
    >
      {label}
    </button>
  );
}

// ── Group mode ───────────────────────────────────────────────────

function GroupedView({ groups }: { groups: InboxGroup[] }) {
  if (groups.length === 0) {
    return <EmptyState filter="unread" />;
  }
  return (
    <ul className="flex flex-col gap-2">
      {groups.map((g) => (
        <GroupCard key={g.key} group={g} />
      ))}
    </ul>
  );
}

function GroupCard({ group }: { group: InboxGroup }) {
  const [expanded, setExpanded] = useState(group.unreadCount > 0);
  const { customer } = group;

  return (
    <li
      className={`rounded-[10px] border bg-white/[0.015] ${
        customer ? 'border-[#1F1F23]' : 'border-white/[0.04]'
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-white/[0.025]"
        aria-expanded={expanded}
      >
        {customer ? (
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-medium leading-none text-white"
            style={{
              background: `linear-gradient(135deg, ${customer.fromColor}, ${customer.toColor})`,
            }}
          >
            {customer.initials}
          </span>
        ) : (
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-[11px] font-medium leading-none text-ink-300"
          >
            {initialsFromName(group.label)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <p className="truncate text-[13.5px] font-medium leading-tight text-ink-50">
              {group.label}
            </p>
            {customer && (
              <span className="rounded-full bg-white/[0.05] px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.06em] text-ink-300">
                {customer.status}
              </span>
            )}
          </div>
          {group.subtitle && (
            <p className="mt-0.5 truncate text-[11.5px] leading-tight text-ink-300">
              {group.subtitle}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-baseline gap-2">
          {group.unreadCount > 0 && (
            <span
              className="rounded-full px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.06em]"
              style={{
                background: 'rgba(232,184,109,0.12)',
                color: '#E8B86D',
              }}
            >
              {group.unreadCount} neu
            </span>
          )}
          <span className="font-mono text-[10px] text-ink-300">
            {group.totalCount}
          </span>
          <span aria-hidden className="font-mono text-[10px] text-ink-300">
            {expanded ? '−' : '+'}
          </span>
        </div>
      </button>
      {expanded && (
        <ul className="flex flex-col border-t border-white/[0.04]">
          {group.items.map((row, i) => (
            <li
              key={row.id}
              className={
                i === 0
                  ? 'border-t border-transparent'
                  : 'border-t border-white/[0.03]'
              }
            >
              <Row row={row} />
            </li>
          ))}
          {customer && (
            <li className="border-t border-white/[0.03] px-1 py-2">
              <Link
                href={`/kunden/${customer.id}`}
                className="inline-flex items-center gap-2 px-2 py-1 text-[11.5px] text-ink-300 transition-colors hover:text-ink-50"
              >
                <span>{customer.openTodos} offene Todos</span>
                <span aria-hidden className="text-ink-400">·</span>
                <span>{customer.activeContracts} aktive Verträge</span>
                <span aria-hidden className="ml-1 text-[#E8B86D]">→</span>
              </Link>
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

// ── Empty + utils ────────────────────────────────────────────────

function EmptyState({ filter }: { filter: InboxFilter }) {
  const text =
    filter === 'unread'
      ? 'Alles erledigt. Keine ungelesenen Nachrichten.'
      : filter === 'archived'
        ? 'Nichts archiviert.'
        : 'Noch nichts hier.';
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <p className="text-[15px] font-medium text-ink-100">{text}</p>
      <p className="text-[12.5px] text-ink-300">
        Sync läuft alle 5 Min, beim Foyer-Open auch sofort.
      </p>
    </div>
  );
}

function cleanName(raw: string): string {
  const m = raw.match(/^(.*)<[^>]+>\s*$/);
  if (m) return m[1].trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '') || raw;
  return raw;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase().slice(0, 2);
}

function formatRel(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.round(diff / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const dd = Math.round(h / 24);
  if (dd < 14) return `${dd}d`;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
}
