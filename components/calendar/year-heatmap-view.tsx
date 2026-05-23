'use client';

import { useMemo } from 'react';
import type { DayDensityCell } from '@/lib/types';

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const DOW = ['Mo', '', 'Mi', '', 'Fr', '', 'So'];

export function YearHeatmapView({
  density,
}: {
  density: DayDensityCell[];
}) {
  const denseMap = useMemo(() => {
    const m = new Map<string, DayDensityCell>();
    for (const d of density) m.set(d.dateIso, d);
    return m;
  }, [density]);

  const days = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    // Adjust to Monday
    while (((start.getDay() + 6) % 7) !== 0) start.setDate(start.getDate() - 1);
    const out: Date[] = [];
    for (let i = 0; i < 53 * 7; i++) {
      out.push(new Date(start.getTime() + i * 86_400_000));
    }
    return out;
  }, []);

  const max = Math.max(1, ...density.map((d) => d.count));

  return (
    <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          Jahres-Heatmap · 12 Monate
        </span>
        <div className="flex items-center gap-1">
          <span className="font-mono text-[9.5px] text-ink-300">weniger</span>
          {[0.15, 0.35, 0.55, 0.75, 1].map((i) => (
            <span
              key={i}
              className="inline-block h-2 w-2 rounded-[1px]"
              style={{ background: `rgba(94, 182, 255, ${i})` }}
            />
          ))}
          <span className="font-mono text-[9.5px] text-ink-300">mehr</span>
        </div>
      </div>
      <div className="flex gap-[3px] overflow-x-auto">
        {/* DOW labels */}
        <div className="flex flex-col gap-[2px] pr-1 pt-4">
          {DOW.map((d, i) => (
            <span
              key={i}
              className="h-[10px] font-mono text-[8.5px] uppercase tracking-[0.3px] text-ink-300"
            >
              {d}
            </span>
          ))}
        </div>
        {/* Weeks */}
        <div className="flex flex-col gap-1">
          <div className="grid grid-flow-col gap-[3px] pl-1 font-mono text-[8.5px] uppercase tracking-[0.3px] text-ink-300" style={{ gridTemplateColumns: 'repeat(53, 1fr)' }}>
            {Array.from({ length: 53 }).map((_, weekIdx) => {
              const monday = days[weekIdx * 7];
              if (!monday) return <span key={weekIdx} />;
              const isFirstWeekOfMonth = monday.getDate() <= 7;
              return (
                <span key={weekIdx} className="h-3 text-center" style={{ minWidth: 10 }}>
                  {isFirstWeekOfMonth ? MONTHS[monday.getMonth()] : ''}
                </span>
              );
            })}
          </div>
          <div
            className="grid grid-flow-col gap-[3px]"
            style={{ gridTemplateColumns: 'repeat(53, 1fr)', gridTemplateRows: 'repeat(7, 1fr)' }}
          >
            {days.map((d, i) => {
              const iso = d.toISOString().slice(0, 10);
              const cell = denseMap.get(iso);
              const intensity = cell ? cell.count / max : 0;
              return (
                <span
                  key={i}
                  title={cell ? `${iso} · ${cell.count} Events` : iso}
                  className="h-[10px] w-[10px] rounded-[1px]"
                  style={{
                    background:
                      intensity === 0
                        ? 'rgba(255,255,255,0.04)'
                        : `rgba(94, 182, 255, ${0.15 + intensity * 0.85})`,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
