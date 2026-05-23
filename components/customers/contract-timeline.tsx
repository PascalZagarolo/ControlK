'use client';

import Link from 'next/link';
import type { ContractTimelineItem } from '@/lib/types';

const STATUS_COLOR: Record<string, string> = {
  aktiv: '#5ee08a',
  auslaufend: '#ffd96a',
  storniert: '#ff8a8a',
  entwurf: '#9c9c9d',
  vorlage: '#7d7d7d',
};

const DAY_MS = 86_400_000;

export function ContractTimeline({
  contracts,
}: {
  contracts: ContractTimelineItem[];
}) {
  if (contracts.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed border-white/[0.08] bg-white/[0.01] py-4 text-center text-[12px] text-ink-300">
        Keine Verträge.
      </div>
    );
  }

  // Compute global window: from earliest start to latest end (+ buffer)
  const now = Date.now();
  let minTs = now - 90 * DAY_MS;
  let maxTs = now + 180 * DAY_MS;
  for (const c of contracts) {
    if (c.startsAt) minTs = Math.min(minTs, new Date(c.startsAt).getTime());
    if (c.endsAt) maxTs = Math.max(maxTs, new Date(c.endsAt).getTime());
  }
  const range = Math.max(DAY_MS, maxTs - minTs);
  const nowPct = ((now - minTs) / range) * 100;

  // Month ticks
  const ticks: { ts: number; label: string }[] = [];
  const start = new Date(minTs);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  for (let d = new Date(start); d.getTime() <= maxTs; d.setMonth(d.getMonth() + 1)) {
    ticks.push({
      ts: d.getTime(),
      label: d.toLocaleString('de-DE', { month: 'short', year: '2-digit' }),
    });
  }

  return (
    <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          Vertrags-Timeline
        </span>
        <div className="flex items-center gap-3">
          {(['aktiv', 'auslaufend', 'storniert', 'entwurf'] as const).map((s) => (
            <span key={s} className="flex items-center gap-1.5 font-mono text-[10px] text-ink-300">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: STATUS_COLOR[s] }}
              />
              {s}
            </span>
          ))}
        </div>
      </div>
      <div className="relative">
        {/* Tick row */}
        <div className="relative h-4 border-b border-white/[0.04]">
          {ticks.map((t) => {
            const left = ((t.ts - minTs) / range) * 100;
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
        {/* Now line */}
        {nowPct >= 0 && nowPct <= 100 && (
          <div
            className="pointer-events-none absolute top-4 bottom-0 w-px bg-[#5eb6ff]/40"
            style={{ left: `${nowPct}%` }}
          />
        )}
        {/* Bars */}
        <div className="mt-2 flex flex-col gap-1.5">
          {contracts.map((c) => {
            const fromTs = c.startsAt ? new Date(c.startsAt).getTime() : minTs;
            const toTs = c.endsAt ? new Date(c.endsAt).getTime() : maxTs;
            const left = ((Math.max(minTs, fromTs) - minTs) / range) * 100;
            const width = ((Math.min(maxTs, toTs) - Math.max(minTs, fromTs)) / range) * 100;
            const color = STATUS_COLOR[c.status] ?? '#9c9c9d';
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
