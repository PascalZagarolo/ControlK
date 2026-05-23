'use client';

import Link from 'next/link';
import { Sparkline } from '@/components/ui/sparkline';
import { VehicleTagBadge } from './vehicle-tag-picker';
import { Avatar } from '@/components/channel/avatar';
import type { Vehicle } from '@/lib/types';

const STATUS_META: Record<string, { label: string; color: string }> = {
  frei: { label: 'Frei', color: '#5ee08a' },
  vermietet: { label: 'Vermietet', color: '#5eb6ff' },
  wartung: { label: 'Wartung', color: '#ffd96a' },
  reserviert: { label: 'Reserviert', color: '#c084fc' },
};

function fmtEur(cents?: number) {
  if (cents == null) return '—';
  return `€${(cents / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
}

function healthColor(score: number): string {
  if (score >= 75) return '#5ee08a';
  if (score >= 50) return '#ffd96a';
  if (score >= 25) return '#ffb45e';
  return '#ff8a8a';
}

export function VehicleTable({
  vehicles,
  selected,
  onToggleSelect,
  onToggleAll,
}: {
  vehicles: Vehicle[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
}) {
  const allSelected = vehicles.length > 0 && vehicles.every((v) => selected.has(v.dbId ?? v.id));

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
            <th className="px-3 py-2">Kennzeichen</th>
            <th className="px-3 py-2">Modell</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Tags</th>
            <th className="px-3 py-2 text-right">KM</th>
            <th className="px-3 py-2 text-right">Auslastung</th>
            <th className="px-3 py-2 text-right">Einnahmen 12M</th>
            <th className="px-3 py-2">Health</th>
            <th className="px-3 py-2">Trend</th>
            <th className="px-3 py-2">Service</th>
            <th className="px-3 py-2">Owner</th>
          </tr>
        </thead>
        <tbody>
          {vehicles.map((v) => {
            const id = v.dbId ?? v.id;
            const sel = selected.has(id);
            const status = STATUS_META[v.status];
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
                    href={`/flotte/${v.id}`}
                    className="font-mono font-medium text-ink-50 hover:text-ink-50"
                  >
                    {v.plate}
                  </Link>
                </td>
                <td className="px-3 py-2 text-ink-300">{v.model}</td>
                <td className="px-3 py-2">
                  <span
                    className="inline-flex h-5 items-center gap-1 rounded-full px-2 font-mono text-[10px] uppercase tracking-[0.3px]"
                    style={{ background: `${status.color}1f`, color: status.color }}
                  >
                    {status.label}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {(v.tags ?? []).slice(0, 2).map((t) => (
                      <VehicleTagBadge key={t.id} tag={t} />
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-ink-100">
                  {v.km.toLocaleString('de-DE')}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-ink-100">
                  {Math.round((v.utilization?.pct90d ?? 0) * 100)}%
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-ink-100">
                  {fmtEur(v.income?.totalCents)}
                </td>
                <td className="px-3 py-2">
                  {v.health ? (
                    <span
                      className="font-mono font-medium tabular-nums"
                      style={{ color: healthColor(v.health.score) }}
                    >
                      {v.health.score}
                    </span>
                  ) : (
                    <span className="text-ink-300">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {v.utilization && (
                    <Sparkline values={v.utilization.spark} color={status.color} width={56} height={14} />
                  )}
                </td>
                <td className="px-3 py-2">
                  {v.serviceForecast?.status === 'overdue' ? (
                    <span className="text-[#ff8a8a]">überfällig</span>
                  ) : v.serviceForecast?.status === 'soon' ? (
                    <span className="text-[#ffd96a]">{v.serviceForecast.daysToNext}d</span>
                  ) : (
                    <span className="text-ink-300">ok</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {v.owner ? (
                    <Avatar
                      initials={v.owner.initials}
                      from={v.owner.from}
                      to={v.owner.to}
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
