'use client';

import Link from 'next/link';
import { Avatar } from '@/components/channel/avatar';
import { Sparkline } from '@/components/ui/sparkline';
import { HealthScoreRing } from './health-score-ring';
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

export function CustomerCard({
  customer,
  selected,
  onToggleSelect,
}: {
  customer: Customer;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const status = STATUS_META[customer.status];
  return (
    <Link
      href={`/kunden/${customer.id}`}
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
          background: `linear-gradient(90deg, ${customer.from} 0%, ${customer.to}66 60%, transparent 100%)`,
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
          aria-label={selected ? 'Auswahl entfernen' : 'Auswählen'}
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
        <Avatar
          initials={customer.initials}
          from={customer.from}
          to={customer.to}
          size={40}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium leading-tight text-ink-50">
            {customer.name}
          </p>
          {customer.industry && (
            <p className="mt-0.5 truncate text-[11.5px] text-ink-300">{customer.industry}</p>
          )}
        </div>
        {customer.health && <HealthScoreRing health={customer.health} size={42} />}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className="inline-flex h-5 items-center gap-1 rounded-full px-2 font-mono text-[10px] uppercase tracking-[0.3px]"
          style={{ background: `${status.color}1f`, color: status.color }}
        >
          <span className="inline-block h-1 w-1 rounded-full" style={{ background: status.color }} />
          {status.label}
        </span>
        {customer.tags?.slice(0, 3).map((t) => (
          <TagBadge key={t.id} tag={t} />
        ))}
        {customer.tags && customer.tags.length > 3 && (
          <span className="font-mono text-[10px] text-ink-300">+{customer.tags.length - 3}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded-[6px] bg-white/[0.02] px-2 py-1.5">
          <p className="font-mono text-[9px] uppercase tracking-[0.3px] text-ink-300">MRC</p>
          <p className="mt-0.5 font-mono text-[12.5px] tabular-nums text-ink-50">
            {customer.forecast ? fmtEur(customer.forecast.activeMrcCents) : customer.totalValue}
          </p>
        </div>
        <div className="rounded-[6px] bg-white/[0.02] px-2 py-1.5">
          <p className="font-mono text-[9px] uppercase tracking-[0.3px] text-ink-300">Verträge</p>
          <p className="mt-0.5 font-mono text-[12.5px] tabular-nums text-ink-50">
            {customer.activeContracts}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
          {customer.quietDays !== undefined && customer.quietDays < 9999
            ? customer.quietDays > 14
              ? `${customer.quietDays}d stumm`
              : `${customer.quietDays}d`
            : customer.lastTouchpoint}
        </span>
        {customer.health && (
          <Sparkline values={customer.health.spark} color={customer.from} width={64} height={16} />
        )}
        {customer.owner && (
          <Avatar
            initials={customer.owner.initials}
            from={customer.owner.from}
            to={customer.owner.to}
            size={20}
          />
        )}
      </div>
    </Link>
  );
}
