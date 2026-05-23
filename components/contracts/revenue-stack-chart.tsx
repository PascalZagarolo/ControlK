'use client';

import type { ContractRevenueBucket } from '@/lib/types';

function fmtEur(cents: number) {
  return `€${(cents / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
}

export function RevenueStackChart({ buckets }: { buckets: ContractRevenueBucket[] }) {
  const max = Math.max(
    1,
    ...buckets.map((b) => b.active + b.expiring + b.pipeline)
  );

  const totalActive = buckets.reduce((acc, b) => acc + b.active, 0);
  const totalExpiring = buckets.reduce((acc, b) => acc + b.expiring, 0);
  const totalPipeline = buckets.reduce((acc, b) => acc + b.pipeline, 0);

  return (
    <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          Revenue-Stack · 12 Monate
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <Legend color="#5ee08a" label="Aktiv" value={fmtEur(totalActive)} />
          <Legend color="#ffd96a" label="Auslaufend" value={fmtEur(totalExpiring)} />
          <Legend color="#5eb6ff" label="Pipeline" value={fmtEur(totalPipeline)} />
        </div>
      </div>

      <div className="flex h-40 items-end gap-1.5">
        {buckets.map((b, i) => {
          const total = b.active + b.expiring + b.pipeline;
          const h = max > 0 ? (total / max) * 100 : 0;
          const activePct = total > 0 ? (b.active / total) * 100 : 0;
          const expiringPct = total > 0 ? (b.expiring / total) * 100 : 0;
          const pipelinePct = total > 0 ? (b.pipeline / total) * 100 : 0;
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="flex w-full flex-col overflow-hidden rounded-t-[2px]"
                style={{ height: `${Math.max(2, h)}%` }}
                title={`${b.label}: ${fmtEur(total)}`}
              >
                {pipelinePct > 0 && (
                  <span
                    className="block w-full bg-[#5eb6ff]/60"
                    style={{ flex: `${pipelinePct} 1 0` }}
                  />
                )}
                {expiringPct > 0 && (
                  <span
                    className="block w-full bg-[#ffd96a]/60"
                    style={{ flex: `${expiringPct} 1 0` }}
                  />
                )}
                {activePct > 0 && (
                  <span
                    className="block w-full bg-[#5ee08a]/60"
                    style={{ flex: `${activePct} 1 0` }}
                  />
                )}
              </div>
              <span className="font-mono text-[9px] uppercase tracking-[0.3px] text-ink-300">
                {b.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Legend({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-[10px] text-ink-300">
      <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: color }} />
      <span>{label}</span>
      <span className="text-ink-100">{value}</span>
    </span>
  );
}
