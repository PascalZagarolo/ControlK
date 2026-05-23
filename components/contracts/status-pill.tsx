'use client';

import type { ContractStatus } from '@/lib/types';

export const STATUS_META: Record<
  ContractStatus,
  { label: string; color: string }
> = {
  aktiv: { label: 'Aktiv', color: '#5ee08a' },
  auslaufend: { label: 'Auslaufend', color: '#ffd96a' },
  storniert: { label: 'Storniert', color: '#ff8a8a' },
  entwurf: { label: 'Entwurf', color: '#9c9c9d' },
  vorlage: { label: 'Vorlage', color: '#5eb6ff' },
};

export function StatusPill({ status }: { status: ContractStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      className="inline-flex h-5 items-center gap-1 rounded-full px-2 font-mono text-[10px] uppercase tracking-[0.3px]"
      style={{ background: `${m.color}1f`, color: m.color }}
    >
      <span className="inline-block h-1 w-1 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}
