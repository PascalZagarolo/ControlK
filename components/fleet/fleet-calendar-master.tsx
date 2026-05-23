'use client';

import Link from 'next/link';
import type { Vehicle } from '@/lib/types';

const COLOR: Record<string, string> = {
  frei: '#5ee08a',
  vermietet: '#5eb6ff',
  wartung: '#ffd96a',
  reserviert: '#c084fc',
};

const DAY_MS = 86_400_000;

export function FleetCalendarMaster({ vehicles }: { vehicles: Vehicle[] }) {
  // 30-day window starting today
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days: Date[] = Array.from(
    { length: 30 },
    (_, i) => new Date(start.getTime() + i * DAY_MS)
  );

  return (
    <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          Fleet-Master · 30 Tage
        </span>
        <div className="flex flex-wrap items-center gap-2.5">
          {(['frei', 'vermietet', 'wartung', 'reserviert'] as const).map((k) => (
            <span key={k} className="flex items-center gap-1 font-mono text-[9.5px] text-ink-300">
              <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: COLOR[k] }} />
              {k}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px]" style={{ minWidth: 800 }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-[#16181d] px-2 py-1 text-left font-mono text-[9px] uppercase tracking-[0.3px] text-ink-300">
                Fahrzeug
              </th>
              {days.map((d, i) => {
                const dow = d.toLocaleString('de-DE', { weekday: 'short' })[0];
                const day = d.getDate();
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <th
                    key={i}
                    className={`px-0 text-center font-mono text-[8px] uppercase tracking-[0.3px] ${
                      isWeekend ? 'text-ink-400' : 'text-ink-300'
                    }`}
                    style={{ minWidth: 18 }}
                  >
                    <div>{dow}</div>
                    <div>{day}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id} className="hover:bg-white/[0.02]">
                <td className="sticky left-0 z-10 bg-[#0e0f12] px-2 py-1">
                  <Link href={`/flotte/${v.id}`} className="block group">
                    <span className="block truncate font-mono text-[11.5px] font-medium text-ink-50 group-hover:underline">
                      {v.plate}
                    </span>
                    <span className="block truncate text-[10px] text-ink-300">{v.model}</span>
                  </Link>
                </td>
                {(v.utilization?.daily ?? []).slice(-30).map((status, i) => (
                  <td key={i} className="p-[1px]">
                    <span
                      title={`${days[i].toLocaleDateString('de-DE')}: ${status}`}
                      className="block h-5 rounded-[1px]"
                      style={{ background: COLOR[status] ?? '#1a1c20' }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
