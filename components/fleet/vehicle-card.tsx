'use client';

import Link from 'next/link';
import { Sparkline } from '@/components/ui/sparkline';
import { VehicleHealthRing } from './vehicle-health-ring';
import { VehicleTagBadge } from './vehicle-tag-picker';
import { Avatar } from '@/components/channel/avatar';
import type { Vehicle } from '@/lib/types';

const STATUS_META: Record<string, { label: string; color: string }> = {
  frei: { label: 'Frei', color: '#5ee08a' },
  vermietet: { label: 'Vermietet', color: '#5eb6ff' },
  wartung: { label: 'Wartung', color: '#ffd96a' },
  reserviert: { label: 'Reserviert', color: '#c084fc' },
};

const KIND_LABEL: Record<string, string> = {
  sprinter: 'Sprinter',
  transporter: 'Transporter',
  pkw: 'PKW',
  kuehlfahrzeug: 'Kühlfahrzeug',
};

function fmtEur(cents?: number) {
  if (cents == null) return '—';
  return `€${(cents / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
}

export function VehicleCard({
  vehicle,
  selected,
  onToggleSelect,
}: {
  vehicle: Vehicle;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const status = STATUS_META[vehicle.status];
  return (
    <Link
      href={`/flotte/${vehicle.id}`}
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
          background: `linear-gradient(90deg, ${status.color} 0%, ${status.color}55 60%, transparent 100%)`,
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
        <span
          className="flex h-10 w-10 items-center justify-center rounded-[8px] text-[18px]"
          style={{ background: `${status.color}1f`, color: status.color }}
        >
          ⊞
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[15px] font-medium leading-tight tracking-[-0.3px] text-ink-50">
            {vehicle.plate}
          </p>
          <p className="mt-0.5 truncate text-[11.5px] text-ink-300">
            {vehicle.model} · {KIND_LABEL[vehicle.kind] ?? vehicle.kind}
          </p>
        </div>
        {vehicle.health && <VehicleHealthRing health={vehicle.health} size={42} />}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className="inline-flex h-5 items-center gap-1 rounded-full px-2 font-mono text-[10px] uppercase tracking-[0.3px]"
          style={{ background: `${status.color}1f`, color: status.color }}
        >
          {status.label}
        </span>
        {vehicle.tags?.slice(0, 3).map((t) => (
          <VehicleTagBadge key={t.id} tag={t} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded-[6px] bg-white/[0.02] px-2 py-1.5">
          <p className="font-mono text-[9px] uppercase tracking-[0.3px] text-ink-300">Auslastung</p>
          <p className="mt-0.5 font-mono text-[12.5px] tabular-nums text-ink-50">
            {Math.round((vehicle.utilization?.pct90d ?? 0) * 100)}%
          </p>
        </div>
        <div className="rounded-[6px] bg-white/[0.02] px-2 py-1.5">
          <p className="font-mono text-[9px] uppercase tracking-[0.3px] text-ink-300">Einnahmen</p>
          <p className="mt-0.5 font-mono text-[12.5px] tabular-nums text-ink-50">
            {fmtEur(vehicle.income?.totalCents)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
          {vehicle.km.toLocaleString('de-DE')} km
          {vehicle.serviceForecast?.status === 'overdue' && (
            <span className="ml-2 text-[#ff8a8a]">· Service</span>
          )}
          {vehicle.serviceForecast?.status === 'soon' && (
            <span className="ml-2 text-[#ffd96a]">· Service bald</span>
          )}
        </span>
        {vehicle.utilization && (
          <Sparkline values={vehicle.utilization.spark} color={status.color} width={64} height={16} />
        )}
        {vehicle.owner && (
          <Avatar
            initials={vehicle.owner.initials}
            from={vehicle.owner.from}
            to={vehicle.owner.to}
            size={20}
          />
        )}
      </div>
    </Link>
  );
}
