'use client';

import Link from 'next/link';
import { Avatar } from '@/components/channel/avatar';
import { StatusPill, STATUS_META } from './status-pill';
import type { Contract } from '@/lib/types';

function fmtEur(cents?: number) {
  if (cents == null) return '—';
  return `€${(cents / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
}

export function ContractCard({
  contract,
  selected,
  onToggleSelect,
}: {
  contract: Contract;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const meta = STATUS_META[contract.status];
  const expiringSoon =
    contract.daysToEnd != null &&
    contract.daysToEnd >= 0 &&
    contract.daysToEnd <= 30 &&
    (contract.status === 'aktiv' || contract.status === 'auslaufend');

  return (
    <Link
      href={`/vertraege/${contract.id}`}
      className={`group relative flex flex-col gap-3 overflow-hidden rounded-[14px] border bg-white/[0.02] p-4 transition-colors ${
        selected
          ? 'border-[#5eb6ff]/40 bg-[#5eb6ff]/[0.04]'
          : 'border-white/[0.06] hover:border-white/[0.14] hover:bg-white/[0.04]'
      }`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
        style={{
          background: `linear-gradient(90deg, ${meta.color} 0%, ${meta.color}55 60%, transparent 100%)`,
        }}
      />

      {onToggleSelect && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleSelect();
          }}
          className={`absolute right-3 top-3 z-10 flex h-4 w-4 items-center justify-center rounded-[4px] border transition-colors ${
            selected
              ? 'border-[#5eb6ff] bg-[#5eb6ff]/15'
              : 'border-white/[0.18] bg-white/[0.04] opacity-0 hover:border-white/[0.32] group-hover:opacity-100'
          }`}
        >
          {selected && (
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#5eb6ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L20 7" />
            </svg>
          )}
        </button>
      )}

      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-[8px] text-[18px]"
          style={{ background: `${meta.color}1f`, color: meta.color }}
        >
          §
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[14px] font-medium leading-tight text-ink-50">
            {contract.title}
          </p>
          {contract.customerName && (
            <p className="mt-0.5 truncate text-[11.5px] text-ink-300">◉ {contract.customerName}</p>
          )}
        </div>
        <StatusPill status={contract.status} />
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded-[6px] bg-white/[0.02] px-2 py-1.5">
          <p className="font-mono text-[9px] uppercase tracking-[0.3px] text-ink-300">Wert</p>
          <p className="mt-0.5 font-mono text-[12.5px] tabular-nums text-ink-50">{contract.value}</p>
        </div>
        <div className="rounded-[6px] bg-white/[0.02] px-2 py-1.5">
          <p className="font-mono text-[9px] uppercase tracking-[0.3px] text-ink-300">Marge</p>
          <p
            className="mt-0.5 font-mono text-[12.5px] tabular-nums"
            style={{
              color:
                (contract.margin?.netCents ?? 0) > 0
                  ? '#5ee08a'
                  : (contract.margin?.netCents ?? 0) < 0
                    ? '#ff8a8a'
                    : '#e6e7ec',
            }}
          >
            {fmtEur(contract.margin?.netCents)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-[10.5px] text-ink-300">
        {contract.endsAt ? (
          <span className={expiringSoon ? 'text-[#ffd96a]' : ''}>
            bis {new Date(contract.endsAt).toLocaleDateString('de-DE')}
            {contract.daysToEnd != null && contract.daysToEnd >= 0 && (
              <span className="ml-1 font-mono">· {contract.daysToEnd}d</span>
            )}
          </span>
        ) : (
          <span>—</span>
        )}
        {contract.vehiclePlate && (
          <span className="font-mono">⊞ {contract.vehiclePlate}</span>
        )}
        {contract.owner && (
          <Avatar
            initials={contract.owner.initials}
            from={contract.owner.from}
            to={contract.owner.to}
            size={20}
          />
        )}
      </div>
    </Link>
  );
}
