'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { InboxCockpit } from '@/components/inbox/inbox-cockpit';
import { InboxRangeDigest } from '@/components/inbox/inbox-range-digest';
import { CommitmentsPanel } from '@/components/inbox/commitments-panel';
import { ChurnPanel } from '@/components/inbox/churn-panel';
import { createTodoFromInboxItem } from '@/lib/actions/inbox-actions';
import { toast } from '@/lib/stores/toast-store';
import type { OpenCommitment } from '@/lib/db/queries/commitments';
import type { ChurnAlert } from '@/lib/db/queries/churn';
import type {
  AwaitingRow,
  AwaitingSplit,
  InboxCategoryKey,
  InboxCounts,
  InboxFilter,
  InboxGroup,
  InboxOverviewPage,
  InboxOverviewRow,
} from '@/lib/db/queries/inbox-overview';

const CATEGORY_LABELS: Record<InboxCategoryKey, string> = {
  primary: 'Primary',
  customer: 'Kunden',
  shipping: 'Versand',
  promo: 'Promos',
  social: 'Social',
  updates: 'Updates',
  forums: 'Forums',
};

// Render order in the sidebar — primary first, then relationship,
// then noise. Mirrors the operations-hub framing: customers loud,
// promos quiet, default in between.
const CATEGORY_ORDER: InboxCategoryKey[] = [
  'primary',
  'customer',
  'shipping',
  'updates',
  'social',
  'promo',
  'forums',
];

export function InboxOverviewClient({
  mode,
  filter,
  category,
  topic,
  gmailConnected,
  pageData,
  groups,
  awaiting,
  counts,
  cockpit,
  customerCount = 0,
  range = null,
  commitments = [],
  churnAlerts = [],
}: {
  mode: 'list' | 'group' | 'awaiting';
  filter: InboxFilter;
  category: InboxCategoryKey | null;
  topic: string | null;
  gmailConnected: boolean;
  pageData: InboxOverviewPage | null;
  groups: InboxGroup[] | null;
  awaiting: AwaitingSplit | null;
  counts: InboxCounts | null;
  cockpit?: AwaitingSplit | null;
  customerCount?: number;
  range?: 'today' | 'week' | null;
  commitments?: OpenCommitment[];
  churnAlerts?: ChurnAlert[];
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
      : mode === 'group'
        ? groups?.reduce((sum, g) => sum + g.totalCount, 0) ?? 0
        : awaiting
          ? awaiting.onYou.length + awaiting.onThem.length
          : 0;

  return (
    <div className="mx-auto flex w-full max-w-[1280px] gap-6 px-4 pb-32 pt-24 md:px-6">
      {/* Sidebar — category + topic filters. Collapses below md but
          stays visible on every desktop width. */}
      <CategorySidebar
        counts={counts}
        activeCategory={category}
        activeTopic={topic}
        setQuery={setQuery}
      />

      <div className="min-w-0 flex-1">
      {/* Time-range buckets + AI synthesis of the active range. */}
      {mode === 'list' && (
        <div className="mb-3 flex items-center gap-1.5">
          <FilterChip
            label="Heute"
            active={range === 'today'}
            onClick={() => setQuery({ range: range === 'today' ? null : 'today', p: null })}
          />
          <FilterChip
            label="Diese Woche"
            active={range === 'week'}
            onClick={() => setQuery({ range: range === 'week' ? null : 'week', p: null })}
          />
          <FilterChip
            label="Alle Zeiträume"
            active={!range}
            onClick={() => setQuery({ range: null, p: null })}
          />
        </div>
      )}
      {mode === 'list' && gmailConnected && range && <InboxRangeDigest range={range} />}

      {/* Morning cockpit — the at-a-glance value, on the default view. */}
      {mode === 'list' && gmailConnected && cockpit && (
        <InboxCockpit
          onYou={cockpit.onYou}
          onThem={cockpit.onThem}
          customerCount={customerCount}
          commitmentsOpen={commitments.length}
          commitmentsOverdue={commitments.filter((c) => c.overdueDays != null).length}
        />
      )}

      {/* Promise Tracker — what YOU owe. */}
      {mode === 'list' && gmailConnected && <CommitmentsPanel commitments={commitments} />}

      {mode === 'list' && gmailConnected && <ChurnPanel alerts={churnAlerts} />}

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
      {mode === 'awaiting' && awaiting && <AwaitingView split={awaiting} />}
      </div>
    </div>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────

function CategorySidebar({
  counts,
  activeCategory,
  activeTopic,
  setQuery,
}: {
  counts: InboxCounts | null;
  activeCategory: InboxCategoryKey | null;
  activeTopic: string | null;
  setQuery: (patch: Record<string, string | null>) => void;
}) {
  const allActive = !activeCategory && !activeTopic;
  return (
    <aside className="hidden w-[220px] shrink-0 flex-col gap-5 md:flex">
      <section className="flex flex-col">
        <SidebarRow
          label="Alle"
          count={counts?.total ?? null}
          active={allActive}
          onClick={() => setQuery({ category: null, topic: null, p: null })}
        />
      </section>

      <section className="flex flex-col gap-1">
        <p className="px-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[#52525B]">
          Typ
        </p>
        {CATEGORY_ORDER.map((cat) => {
          const c = counts?.byCategory[cat] ?? 0;
          if (c === 0 && activeCategory !== cat) return null;
          return (
            <SidebarRow
              key={cat}
              label={CATEGORY_LABELS[cat]}
              count={c}
              active={activeCategory === cat}
              onClick={() =>
                setQuery({
                  category: activeCategory === cat ? null : cat,
                  topic: null,
                  p: null,
                })
              }
              dim={cat === 'promo' || cat === 'forums'}
            />
          );
        })}
      </section>

      {counts && counts.topics.length > 0 && (
        <section className="flex flex-col gap-1">
          <p className="px-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[#52525B]">
            Themen
          </p>
          {counts.topics.map((t) => (
            <SidebarRow
              key={t.topic}
              label={t.topic}
              count={t.count}
              active={activeTopic === t.topic}
              onClick={() =>
                setQuery({
                  category: null,
                  topic: activeTopic === t.topic ? null : t.topic,
                  mode: 'list',
                  p: null,
                })
              }
              accent="#E8B86D"
            />
          ))}
        </section>
      )}

      {counts && counts.topics.length === 0 && (
        <p className="px-2 text-[11.5px] leading-[1.55] text-[#52525B]">
          AI-Themen erscheinen, sobald neue Mails synced wurden. Cron alle
          5 min.
        </p>
      )}
    </aside>
  );
}

function SidebarRow({
  label,
  count,
  active,
  onClick,
  dim,
  accent,
}: {
  label: string;
  count: number | null;
  active: boolean;
  onClick: () => void;
  dim?: boolean;
  accent?: string;
}) {
  const baseText = active
    ? '#FAFAFA'
    : dim
      ? '#52525B'
      : accent ?? '#A1A1AA';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-baseline justify-between rounded-md px-2 py-1.5 text-left transition-colors ${
        active ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]'
      }`}
    >
      <span
        className="truncate text-[13px]"
        style={{ color: baseText }}
      >
        {label}
      </span>
      {count !== null && (
        <span
          className="ml-2 shrink-0 font-mono text-[10.5px]"
          style={{ color: active ? '#FAFAFA' : '#52525B' }}
        >
          {count}
        </span>
      )}
    </button>
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
  mode: 'list' | 'group' | 'awaiting';
  onChange: (next: 'list' | 'group' | 'awaiting') => void;
}) {
  const labels = {
    list: 'Chronologisch',
    group: 'Nach Kunde',
    awaiting: 'Wartet',
  } as const;
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-white/[0.06] bg-white/[0.02] p-0.5">
      {(['list', 'group', 'awaiting'] as const).map((m) => (
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
          {labels[m]}
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
  // Sender column links to /people/[email]; subject + time link to the mail.
  // The whole row is a <div> (not one outer Link), so the "→ Todo" action can
  // be a real sibling button rather than an invalid button-inside-anchor.
  const router = useRouter();
  const [pending, start] = useTransition();

  const toTodo = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    start(async () => {
      const r = await createTodoFromInboxItem(row.id);
      toast(r.ok ? 'Als Todo angelegt — Mail archiviert' : r.error, r.ok ? 'success' : 'danger');
      if (r.ok) router.refresh();
    });
  };

  return (
    <div className="group grid grid-cols-[180px_1fr_72px] items-baseline gap-4 px-1 py-3 transition-colors duration-150 hover:bg-white/[0.025]">
      <div className="min-w-0">
        {row.senderEmail ? (
          <Link
            href={`/people/${encodeURIComponent(row.senderEmail)}`}
            className={`truncate text-[13.5px] leading-tight transition-colors hover:text-[#E8B86D] ${
              row.isRead ? 'text-ink-200' : 'font-medium text-ink-50'
            }`}
          >
            {cleanName(row.senderName)}
          </Link>
        ) : (
          <span
            className={`truncate text-[13.5px] leading-tight ${
              row.isRead ? 'text-ink-200' : 'font-medium text-ink-50'
            }`}
          >
            {cleanName(row.senderName)}
          </span>
        )}
        {!row.isRead && (
          <span
            aria-hidden
            className="mt-1 inline-block h-1 w-1 rounded-full"
            style={{ background: '#E8B86D' }}
          />
        )}
      </div>
      {/* Subject column is a relative container so the hover "→ Todo" action
          sits as a SIBLING of the link (never a button inside an anchor). */}
      <div className="relative min-w-0">
        <Link href={`/inbox/${row.id}`} className="block min-w-0 cursor-pointer">
          <p
            className={`truncate pr-16 text-[13.5px] leading-tight ${
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
        </Link>
        <button
          type="button"
          onClick={toTodo}
          disabled={pending}
          className="absolute right-0 top-0 rounded-sm bg-[#0E0F11] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.3px] text-[#71717A] opacity-0 transition-all hover:text-[#5E9EFF] focus:opacity-100 group-hover:opacity-100 disabled:opacity-40"
          title="Diese Mail als Todo erfassen"
        >
          → Todo
        </button>
      </div>
      <Link
        href={`/inbox/${row.id}`}
        className="justify-self-end font-mono text-[10.5px] uppercase tracking-[0.06em] text-[#52525B]"
      >
        {formatRel(row.receivedAt)}
      </Link>
    </div>
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

// ── Awaiting split view ─────────────────────────────────────────

function AwaitingView({ split }: { split: AwaitingSplit }) {
  const { onYou, onThem } = split;
  if (onYou.length === 0 && onThem.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="text-[15px] font-medium text-ink-100">
          Niemand wartet auf irgendwen.
        </p>
        <p className="text-[12.5px] text-ink-300">
          Keine ungelesenen Mails, keine ungeantworteten Threads.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <AwaitingColumn
        kicker="Auf dich wartet"
        subtitle={`${onYou.length} ${onYou.length === 1 ? 'Person' : 'Personen'}`}
        accent="receive"
        rows={onYou}
        emptyMsg="Niemand wartet gerade auf eine Antwort von dir."
      />
      <AwaitingColumn
        kicker="Du wartest auf"
        subtitle={`${onThem.length} ${onThem.length === 1 ? 'Person' : 'Personen'} · ältere zuerst`}
        accent="send"
        rows={onThem}
        emptyMsg="Keine gesendeten Mails ohne Antwort (älter als 3 Tage)."
      />
    </div>
  );
}

function AwaitingColumn({
  kicker,
  subtitle,
  accent,
  rows,
  emptyMsg,
}: {
  kicker: string;
  subtitle: string;
  accent: 'receive' | 'send';
  rows: AwaitingRow[];
  emptyMsg: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-col gap-0.5 border-l-2 pl-3" style={{
        borderColor: accent === 'receive' ? '#E8B86D' : '#71717A',
      }}>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#52525B]">
          {kicker}
        </span>
        <p className="text-[13px] text-ink-100">{subtitle}</p>
      </header>
      {rows.length === 0 ? (
        <p className="rounded-[10px] border border-white/[0.04] bg-white/[0.015] px-3 py-6 text-center text-[12.5px] leading-[1.6] text-ink-300">
          {emptyMsg}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((row) => (
            <li key={row.id}>
              <AwaitingRowItem row={row} accent={accent} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AwaitingRowItem({
  row,
  accent,
}: {
  row: AwaitingRow;
  accent: 'receive' | 'send';
}) {
  // Urgency colouring: green-ish (calm) up to 5d, amber 6-13d, red 14d+.
  // Only applied on the "Du wartest auf" column — receiving-side
  // urgency is the user's own choice and doesn't need scolding.
  const urgencyColor =
    accent === 'send'
      ? row.ageDays >= 14
        ? '#D88A8A'
        : row.ageDays >= 6
          ? '#E8B86D'
          : '#71717A'
      : '#71717A';

  const personLabel =
    accent === 'send'
      ? row.awaitingRecipient || row.senderName
      : row.senderName;

  return (
    <Link
      href={`/inbox/${row.id}`}
      className="block rounded-[10px] border border-white/[0.04] bg-white/[0.015] px-3 py-2.5 transition-colors hover:border-white/[0.12] hover:bg-white/[0.03]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p
          className={`min-w-0 flex-1 truncate text-[13px] font-medium leading-tight ${
            row.isRead ? 'text-ink-200' : 'text-ink-50'
          }`}
        >
          {cleanName(personLabel)}
        </p>
        <span
          className="shrink-0 font-mono text-[10px] uppercase tracking-[0.06em]"
          style={{ color: urgencyColor }}
        >
          {ageLabel(row.ageDays)}
        </span>
      </div>
      <p className="mt-1 truncate text-[12.5px] leading-tight text-ink-200">
        {row.subject || '(kein Betreff)'}
      </p>
      {row.preview && (
        <p className="mt-1 truncate text-[11.5px] leading-tight text-[#71717A]">
          {row.preview}
        </p>
      )}
    </Link>
  );
}

function ageLabel(days: number): string {
  if (days < 1) return 'heute';
  if (days === 1) return '1 Tag';
  if (days < 14) return `${days} Tage`;
  if (days < 30) return `${Math.floor(days / 7)} Wochen`;
  return `${Math.floor(days / 30)} Monate`;
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
