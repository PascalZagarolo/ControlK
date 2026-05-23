'use client';

import { useMemo } from 'react';
import type { DayDensityCell } from '@/lib/types';

export type CalendarSmartView =
  | 'all'
  | 'today'
  | 'thisWeek'
  | 'conflicts'
  | 'openChecklists';

const DOW = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function CalendarSidebar({
  smartView,
  setSmartView,
  counts,
  density,
  cursor,
  setCursor,
}: {
  smartView: CalendarSmartView;
  setSmartView: (v: CalendarSmartView) => void;
  counts: {
    today: number;
    thisWeek: number;
    conflicts: number;
    openChecklists: number;
  };
  density: DayDensityCell[];
  cursor: Date;
  setCursor: (d: Date) => void;
}) {
  // Build current-month grid for mini calendar
  const grid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const firstDow = (first.getDay() + 6) % 7; // Monday=0
    const days: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < firstDow; i++) {
      const d = new Date(year, month, 1 - (firstDow - i));
      days.push({ date: d, inMonth: false });
    }
    for (let i = 1; i <= last.getDate(); i++) {
      days.push({ date: new Date(year, month, i), inMonth: true });
    }
    const tail = 42 - days.length;
    for (let i = 1; i <= tail; i++) {
      days.push({ date: new Date(year, month + 1, i), inMonth: false });
    }
    return days;
  }, [cursor]);

  const densityMap = useMemo(() => {
    const m = new Map<string, DayDensityCell>();
    for (const d of density) m.set(d.dateIso, d);
    return m;
  }, [density]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const cursorIso = cursor.toISOString().slice(0, 10);
  const max = Math.max(1, ...density.map((d) => d.count));

  const smartViews: { key: CalendarSmartView; label: string; count: number; dot: string }[] = [
    { key: 'all', label: 'Alle', count: 0, dot: 'bg-ink-300' },
    { key: 'today', label: 'Heute', count: counts.today, dot: 'bg-[#5eb6ff]' },
    { key: 'thisWeek', label: 'Diese Woche', count: counts.thisWeek, dot: 'bg-[#5ee08a]' },
    { key: 'conflicts', label: 'Konflikte', count: counts.conflicts, dot: 'bg-[#ff8a8a]' },
    {
      key: 'openChecklists',
      label: 'Offene Checklisten',
      count: counts.openChecklists,
      dot: 'bg-[#ffd96a]',
    },
  ];

  return (
    <aside className="hidden w-[240px] shrink-0 lg:block">
      <div className="sticky top-[88px] flex max-h-[calc(100vh-100px)] flex-col gap-3 overflow-y-auto pr-2">
        <SectionLabel>Smart-Views</SectionLabel>
        <div className="flex flex-col">
          {smartViews.map((sv) => {
            const active = sv.key === smartView;
            return (
              <button
                key={sv.key}
                type="button"
                onClick={() => setSmartView(sv.key)}
                className={`flex items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-left text-[13px] leading-tight transition-colors ${
                  active
                    ? 'bg-white/[0.06] text-ink-50'
                    : 'text-ink-200 hover:bg-white/[0.04] hover:text-ink-50'
                }`}
              >
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${sv.dot}`} />
                <span className="min-w-0 flex-1 truncate">{sv.label}</span>
                {sv.count > 0 && (
                  <span className="font-mono text-[10.5px] text-ink-300">{sv.count}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-2 rounded-[10px] border border-white/[0.06] bg-white/[0.02] p-2">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="font-mono text-[11px] text-ink-300 hover:text-ink-50"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => setCursor(new Date())}
              className="font-mono text-[10.5px] uppercase tracking-[0.3px] text-ink-100 hover:underline"
            >
              {cursor.toLocaleString('de-DE', { month: 'short', year: 'numeric' })}
            </button>
            <button
              type="button"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="font-mono text-[11px] text-ink-300 hover:text-ink-50"
            >
              →
            </button>
          </div>
          <div className="grid grid-cols-7 gap-[2px] text-center font-mono text-[8.5px] uppercase tracking-[0.3px] text-ink-300">
            {DOW.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-[2px]">
            {grid.map((cell, i) => {
              const iso = cell.date.toISOString().slice(0, 10);
              const den = densityMap.get(iso);
              const intensity = den ? den.count / max : 0;
              const isToday = iso === todayIso;
              const isCursor = iso === cursorIso;
              const baseBg = isCursor
                ? 'rgba(94, 182, 255, 0.20)'
                : den
                  ? `rgba(94, 182, 255, ${0.15 + intensity * 0.45})`
                  : 'transparent';
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCursor(cell.date)}
                  title={den ? `${iso} · ${den.count} Events` : iso}
                  className={`relative flex h-6 items-center justify-center rounded-[3px] font-mono text-[10px] tabular-nums transition-colors ${
                    cell.inMonth ? 'text-ink-100' : 'text-ink-400'
                  } ${isToday ? 'ring-1 ring-[#5eb6ff]/50' : ''}`}
                  style={{ background: baseBg }}
                >
                  {cell.date.getDate()}
                  {den && den.count > 0 && (
                    <span className="absolute bottom-0.5 left-1/2 inline-block h-[2px] w-1.5 -translate-x-1/2 rounded-full bg-[#5eb6ff]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pt-1 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
      {children}
    </div>
  );
}
