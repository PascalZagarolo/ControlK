'use client';

import Link from 'next/link';
import { Avatar } from '@/components/channel/avatar';
import { StatusPill } from './status-pill';
import type { Contract } from '@/lib/types';

function fmtEur(cents?: number) {
  if (cents == null) return '—';
  return `€${(cents / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
}

export function ContractTable({
  contracts,
  selected,
  onToggleSelect,
  onToggleAll,
}: {
  contracts: Contract[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
}) {
  const allSelected =
    contracts.length > 0 && contracts.every((c) => selected.has(c.dbId ?? c.id));
  return (
    <div className="overflow-x-auto rounded-[12px] border border-white/[0.06] bg-white/[0.02]">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-white/[0.06] text-left font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
            <th className="w-8 px-3 py-2">
              <button
                type="button"
                onClick={onToggleAll}
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
            <th className="px-3 py-2">Titel</th>
            <th className="px-3 py-2">Kunde</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">Wert</th>
            <th className="px-3 py-2 text-right">Marge</th>
            <th className="px-3 py-2">Restlaufzeit</th>
            <th className="px-3 py-2">Fahrzeug</th>
            <th className="px-3 py-2">Owner</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((c) => {
            const id = c.dbId ?? c.id;
            const sel = selected.has(id);
            const expiringSoon =
              c.daysToEnd != null &&
              c.daysToEnd >= 0 &&
              c.daysToEnd <= 14 &&
              (c.status === 'aktiv' || c.status === 'auslaufend');
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
                    href={`/vertraege/${c.id}`}
                    className="font-medium text-ink-50 hover:underline"
                  >
                    {c.title}
                  </Link>
                </td>
                <td className="px-3 py-2 text-ink-300">
                  {c.customerName ? (
                    <Link href={`/kunden/${c.customerId}`} className="hover:text-ink-50">
                      {c.customerName}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2">
                  <StatusPill status={c.status} />
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-ink-100">
                  {c.value}
                </td>
                <td
                  className="px-3 py-2 text-right font-mono tabular-nums"
                  style={{
                    color:
                      (c.margin?.netCents ?? 0) > 0
                        ? '#5ee08a'
                        : (c.margin?.netCents ?? 0) < 0
                          ? '#ff8a8a'
                          : '#9c9c9d',
                  }}
                >
                  {fmtEur(c.margin?.netCents)}
                </td>
                <td className={`px-3 py-2 ${expiringSoon ? 'text-[#ffd96a]' : 'text-ink-300'}`}>
                  {c.daysToEnd != null && c.daysToEnd >= 0
                    ? `${c.daysToEnd}d`
                    : c.daysToEnd != null && c.daysToEnd < 0
                      ? `${Math.abs(c.daysToEnd)}d über`
                      : '—'}
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-ink-300">
                  {c.vehiclePlate ?? '—'}
                </td>
                <td className="px-3 py-2">
                  {c.owner ? (
                    <Avatar
                      initials={c.owner.initials}
                      from={c.owner.from}
                      to={c.owner.to}
                      size={20}
                    />
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
