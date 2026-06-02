'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { CustomerOverviewRow } from '@/lib/db/queries/clients';

// Calm customer OVERVIEW (wedge). A read-only view onto what Ctrl+K already
// knows per tagged client — open commitments, who's waiting, last contact.
// No CRM: nothing here is edited except the optional note (on the detail page).
// Hierarchy via typography + spacing, not a card grid. Sand/gold is reserved
// for genuine urgency (overdue), red for overdue promises, blue for waiting.

type Sort = 'urgency' | 'name' | 'recent';

const C = {
  bg: '#0A0A0C',
  fg: '#F0F0F2',
  muted: '#9c9c9d',
  faint: '#7c7c83',
  hair: 'rgba(255,255,255,0.06)',
  overdue: '#ff8a8a',
  waiting: '#5E9EFF',
  gold: '#E8B86D',
  calm: '#52525B',
};

function relDays(days: number | null): string {
  if (days === null) return 'kein Kontakt';
  if (days === 0) return 'heute';
  if (days === 1) return 'gestern';
  if (days < 7) return `vor ${days} Tagen`;
  if (days < 30) return `vor ${Math.floor(days / 7)} Wo.`;
  if (days < 365) return `vor ${Math.floor(days / 30)} Mon.`;
  return `vor ${Math.floor(days / 365)} J.`;
}

export function KundenWedgeClient({ rows }: { rows: CustomerOverviewRow[] }) {
  const [sort, setSort] = useState<Sort>('urgency');

  const sorted = useMemo(() => {
    const copy = [...rows];
    if (sort === 'name') {
      copy.sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'));
    } else if (sort === 'recent') {
      copy.sort(
        (a, b) => (a.lastInteractionDays ?? Infinity) - (b.lastInteractionDays ?? Infinity)
      );
    }
    // 'urgency' keeps the server order (overdue → waiting → open → recent).
    return copy;
  }, [rows, sort]);

  const needAttention = rows.filter(
    (r) => r.overdueCommitments > 0 || r.waitingDays !== null
  ).length;

  return (
    <main className="min-h-screen" style={{ background: C.bg, color: C.fg }}>
      <div className="mx-auto w-full max-w-3xl px-5 pb-24 pt-24 sm:px-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-[26px] font-semibold tracking-[-0.01em] sm:text-[30px]">Kunden</h1>
          <p className="text-[14px] leading-relaxed" style={{ color: C.muted }}>
            {rows.length === 0
              ? 'Markiere Absender im Posteingang als Kunde — dann erscheinen sie hier mit allem, was offen ist.'
              : needAttention > 0
                ? `${needAttention} ${needAttention === 1 ? 'Kunde braucht' : 'Kunden brauchen'} gerade deine Aufmerksamkeit.`
                : 'Alles ruhig — bei keinem Kunden ist gerade etwas offen.'}
          </p>
        </header>

        {rows.length > 0 && (
          <div className="mt-6 flex items-center gap-1">
            {(
              [
                ['urgency', 'Dringlichkeit'],
                ['recent', 'Letzter Kontakt'],
                ['name', 'Name'],
              ] as [Sort, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSort(key)}
                className="rounded-md px-2.5 py-1 text-[12px] font-medium leading-none transition-colors"
                style={
                  sort === key
                    ? { background: 'rgba(255,255,255,0.06)', color: C.fg }
                    : { color: C.faint }
                }
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <ul className="mt-3 flex flex-col">
          {sorted.map((r) => (
            <CustomerRow key={r.tagId} row={r} />
          ))}
        </ul>
      </div>
    </main>
  );
}

function CustomerRow({ row }: { row: CustomerOverviewRow }) {
  const calm =
    row.overdueCommitments === 0 &&
    row.waitingDays === null &&
    row.openCommitments === 0;

  return (
    <li>
      <Link
        href={`/kunden/${row.tagId}`}
        className="group flex items-center gap-4 border-b py-3.5 transition-colors hover:bg-white/[0.02]"
        style={{ borderColor: C.hair }}
      >
        {/* Urgency rail — red overdue, blue waiting, else nothing loud. */}
        <span
          aria-hidden
          className="h-9 w-[3px] shrink-0 rounded-full"
          style={{
            background:
              row.overdueCommitments > 0
                ? C.overdue
                : row.waitingDays !== null
                  ? C.waiting
                  : 'transparent',
          }}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="truncate text-[15px] font-medium" style={{ color: C.fg }}>
              {row.displayName}
            </p>
            {row.kind === 'domain' && (
              <span
                className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.2px]"
                style={{ color: C.calm }}
              >
                Firma
              </span>
            )}
          </div>
          {/* Signals — only what's true; calm clients say so plainly. */}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px]">
            {row.overdueCommitments > 0 && (
              <span style={{ color: C.overdue }}>
                {row.overdueCommitments} überfällige{' '}
                {row.overdueCommitments === 1 ? 'Zusage' : 'Zusagen'}
              </span>
            )}
            {row.openCommitments - row.overdueCommitments > 0 && (
              <span style={{ color: C.muted }}>
                {row.openCommitments - row.overdueCommitments} offene{' '}
                {row.openCommitments - row.overdueCommitments === 1 ? 'Zusage' : 'Zusagen'}
              </span>
            )}
            {row.waitingDays !== null && (
              <span style={{ color: C.waiting }}>
                wartet seit {row.waitingDays} {row.waitingDays === 1 ? 'Tag' : 'Tagen'}
              </span>
            )}
            {calm && <span style={{ color: C.calm }}>nichts Offenes</span>}
            {row.note && (
              <span className="truncate" style={{ color: C.faint }} title={row.note}>
                · {row.note}
              </span>
            )}
          </div>
        </div>

        <span
          className="shrink-0 font-mono text-[11px] tabular-nums"
          style={{ color: C.faint }}
        >
          {relDays(row.lastInteractionDays)}
        </span>
      </Link>
    </li>
  );
}
