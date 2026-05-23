'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { STATUS_META } from './status-pill';
import type { Contract } from '@/lib/types';

const DAY_MS = 86_400_000;

export function ContractTimelineStripe({ contracts }: { contracts: Contract[] }) {
  const dated = contracts.filter((c) => c.startsAt && c.endsAt);
  const range = useMemo(() => {
    if (dated.length === 0) {
      const now = Date.now();
      return { minTs: now - 90 * DAY_MS, maxTs: now + 365 * DAY_MS };
    }
    let minTs = Infinity;
    let maxTs = -Infinity;
    for (const c of dated) {
      const s = new Date(c.startsAt!).getTime();
      const e = new Date(c.endsAt!).getTime();
      if (s < minTs) minTs = s;
      if (e > maxTs) maxTs = e;
    }
    return { minTs, maxTs };
  }, [dated]);

  if (dated.length === 0) {
    return (
      <div className="rounded-[12px] border border-dashed border-white/[0.10] bg-white/[0.01] py-12 text-center text-[13px] text-ink-300">
        Keine Verträge mit Datumsspanne.
      </div>
    );
  }

  const totalRange = Math.max(DAY_MS, range.maxTs - range.minTs);
  const now = Date.now();
  const nowPct = ((now - range.minTs) / totalRange) * 100;

  const ticks: { ts: number; label: string }[] = [];
  const startTick = new Date(range.minTs);
  startTick.setDate(1);
  startTick.setHours(0, 0, 0, 0);
  for (let d = new Date(startTick); d.getTime() <= range.maxTs; d.setMonth(d.getMonth() + 1)) {
    ticks.push({
      ts: d.getTime(),
      label: d.toLocaleString('de-DE', { month: 'short', year: '2-digit' }),
    });
  }

  return (
    <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          Vertrags-Timeline · {dated.length} Verträge
        </span>
        <div className="flex flex-wrap items-center gap-2.5">
          {(['aktiv', 'auslaufend', 'storniert', 'entwurf'] as const).map((s) => (
            <span key={s} className="flex items-center gap-1.5 font-mono text-[10px] text-ink-300">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: STATUS_META[s].color }}
              />
              {s}
            </span>
          ))}
        </div>
      </div>
      <div className="relative">
        <div className="relative h-4 border-b border-white/[0.04]">
          {ticks.map((t) => {
            const left = ((t.ts - range.minTs) / totalRange) * 100;
            return (
              <span
                key={t.ts}
                className="absolute -translate-x-1/2 font-mono text-[9px] uppercase tracking-[0.3px] text-ink-300"
                style={{ left: `${left}%` }}
              >
                {t.label}
              </span>
            );
          })}
        </div>
        {nowPct >= 0 && nowPct <= 100 && (
          <div
            className="pointer-events-none absolute top-4 bottom-0 w-px bg-[#5eb6ff]/40"
            style={{ left: `${nowPct}%` }}
          />
        )}
        <div className="mt-2 flex flex-col gap-1.5">
          {dated.map((c) => {
            const fromTs = new Date(c.startsAt!).getTime();
            const toTs = new Date(c.endsAt!).getTime();
            const left = ((fromTs - range.minTs) / totalRange) * 100;
            const width = ((toTs - fromTs) / totalRange) * 100;
            const color = STATUS_META[c.status].color;
            return (
              <Link
                key={c.id}
                href={`/vertraege/${c.id}`}
                className="group relative block h-6"
                title={`${c.title} · ${c.status}`}
              >
                <div className="absolute inset-x-0 inset-y-1 rounded-[3px] bg-white/[0.02]" />
                <div
                  className="absolute inset-y-1 flex items-center rounded-[3px] px-1.5 text-[10.5px] leading-none transition-all group-hover:brightness-125"
                  style={{
                    left: `${Math.max(0, left)}%`,
                    width: `${Math.max(2, width)}%`,
                    background: `${color}33`,
                    boxShadow: `inset 0 0 0 1px ${color}66`,
                    color: '#e6e7ec',
                  }}
                >
                  <span className="truncate">{c.title}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
