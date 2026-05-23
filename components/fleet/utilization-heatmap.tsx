'use client';

const STATUS_COLOR: Record<string, string> = {
  frei: '#5ee08a',
  vermietet: '#5eb6ff',
  wartung: '#ffd96a',
  reserviert: '#c084fc',
};

export function UtilizationHeatmap({
  daily,
  pct90d,
  pct30d,
}: {
  daily: ('frei' | 'vermietet' | 'wartung' | 'reserviert')[];
  pct90d: number;
  pct30d: number;
}) {
  // Layout: 13 weeks × 7 days (89 days + today)
  const grid: string[][] = Array.from({ length: 13 }, () => Array(7).fill('frei'));
  const now = new Date();
  const todayDOW = now.getDay();
  for (let i = 0; i < daily.length; i++) {
    const dayIdx = daily.length - 1 - i;
    const week = Math.floor(i / 7);
    if (week >= 13) break;
    const dow = (todayDOW - i + 700) % 7;
    grid[12 - week][dow] = daily[dayIdx];
  }

  return (
    <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            Utilization · 90 Tage
          </span>
          <span className="mt-0.5 font-mono text-[14px] tabular-nums text-ink-50">
            {Math.round(pct90d * 100)}%{' '}
            <span className="text-[10px] uppercase text-ink-300">90d</span>
            <span className="ml-2 text-[12px] text-ink-200">
              {Math.round(pct30d * 100)}%
            </span>
            <span className="ml-1 text-[10px] uppercase text-ink-300">30d</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {(['frei', 'vermietet', 'wartung', 'reserviert'] as const).map((k) => (
            <span key={k} className="flex items-center gap-1 font-mono text-[9.5px] text-ink-300">
              <span
                className="inline-block h-2 w-2 rounded-[2px]"
                style={{ background: STATUS_COLOR[k] }}
              />
              {k}
            </span>
          ))}
        </div>
      </div>
      <div className="flex gap-[2px]">
        {grid.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[2px]">
            {week.map((status, di) => (
              <span
                key={di}
                title={status}
                className="h-3 w-3 rounded-[2px]"
                style={{ background: STATUS_COLOR[status] ?? '#1a1c20' }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.3px] text-ink-300">
        <span>13 W vor</span>
        <span>heute</span>
      </div>
    </div>
  );
}
