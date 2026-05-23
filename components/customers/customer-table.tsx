'use client';

import Link from 'next/link';
import { Avatar } from '@/components/channel/avatar';
import { Sparkline } from '@/components/ui/sparkline';
import { TagBadge } from './tag-badge';
import type { Customer } from '@/lib/types';

const STATUS_META = {
  aktiv: { label: 'Aktiv', color: '#5ee08a' },
  lead: { label: 'Lead', color: '#5eb6ff' },
  inaktiv: { label: 'Inaktiv', color: '#7d7d7d' },
} as const;

function fmtEur(cents: number) {
  return `€${(cents / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
}

function healthColor(score: number): string {
  if (score >= 75) return '#5ee08a';
  if (score >= 50) return '#ffd96a';
  if (score >= 25) return '#ffb45e';
  return '#ff8a8a';
}

export function CustomerTable({
  customers,
  selected,
  onToggleSelect,
  onToggleAll,
}: {
  customers: Customer[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
}) {
  const allSelected = customers.length > 0 && customers.every((c) => selected.has(c.dbId ?? c.id));

  return (
    <div className="overflow-x-auto rounded-[12px] border border-white/[0.06] bg-white/[0.02]">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-white/[0.06] text-left font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
            <th className="w-8 px-3 py-2">
              <button
                type="button"
                onClick={onToggleAll}
                aria-label="Alle"
                className={`flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border ${
                  allSelected ? 'border-[#5eb6ff] bg-[#5eb6ff]/15' : 'border-white/[0.18]'
                }`}
              >
                {allSelected && (
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#5eb6ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                )}
              </button>
            </th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Branche</th>
            <th className="px-3 py-2">Tags</th>
            <th className="px-3 py-2 text-right">MRC</th>
            <th className="px-3 py-2 text-right">Verträge</th>
            <th className="px-3 py-2">Health</th>
            <th className="px-3 py-2">Trend</th>
            <th className="px-3 py-2">Letzter Kontakt</th>
            <th className="px-3 py-2">Owner</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => {
            const id = c.dbId ?? c.id;
            const sel = selected.has(id);
            const status = STATUS_META[c.status];
            return (
              <tr
                key={id}
                className={`border-b border-white/[0.04] transition-colors hover:bg-white/[0.03] ${
                  sel ? 'bg-[#5eb6ff]/[0.04]' : ''
                }`}
              >
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onToggleSelect(id)}
                    aria-label={sel ? 'Auswahl entfernen' : 'Auswählen'}
                    className={`flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border ${
                      sel ? 'border-[#5eb6ff] bg-[#5eb6ff]/15' : 'border-white/[0.18]'
                    }`}
                  >
                    {sel && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#5eb6ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    )}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/kunden/${c.id}`}
                    className="flex items-center gap-2.5 hover:text-ink-50"
                  >
                    <Avatar initials={c.initials} from={c.from} to={c.to} size={24} />
                    <span className="font-medium text-ink-50">{c.name}</span>
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <span
                    className="inline-flex h-5 items-center gap-1 rounded-full px-2 font-mono text-[10px] uppercase tracking-[0.3px]"
                    style={{ background: `${status.color}1f`, color: status.color }}
                  >
                    {status.label}
                  </span>
                </td>
                <td className="px-3 py-2 text-ink-300">{c.industry || '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {(c.tags ?? []).slice(0, 2).map((t) => (
                      <TagBadge key={t.id} tag={t} />
                    ))}
                    {c.tags && c.tags.length > 2 && (
                      <span className="font-mono text-[10px] text-ink-300">+{c.tags.length - 2}</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-ink-100">
                  {c.forecast ? fmtEur(c.forecast.activeMrcCents) : c.totalValue}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-ink-100">
                  {c.activeContracts}
                </td>
                <td className="px-3 py-2">
                  {c.health ? (
                    <span
                      className="font-mono font-medium tabular-nums"
                      style={{ color: healthColor(c.health.score) }}
                    >
                      {c.health.score}
                    </span>
                  ) : (
                    <span className="text-ink-300">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {c.health && (
                    <Sparkline values={c.health.spark} color={c.from} width={56} height={14} />
                  )}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={c.quietDays !== undefined && c.quietDays > 14 ? 'text-[#ffd96a]' : 'text-ink-300'}
                  >
                    {c.quietDays !== undefined && c.quietDays < 9999
                      ? `vor ${c.quietDays}d`
                      : c.lastTouchpoint}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {c.owner ? (
                    <span title={c.owner.name}>
                      <Avatar
                        initials={c.owner.initials}
                        from={c.owner.from}
                        to={c.owner.to}
                        size={20}
                      />
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-ink-300">∅</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
