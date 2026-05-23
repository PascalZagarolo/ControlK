'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { KIND_META } from './event-color';

type ResourceRow = {
  vehicleId: string;
  externalId: string;
  plate: string;
  model: string;
  status: string;
  events: {
    id: string;
    kind: string;
    title: string;
    startsAt: string;
    endsAt: string;
    customerName?: string;
  }[];
};

const DOW = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export function ResourceView({
  cursor,
  rows,
  onOpen,
  days = 14,
}: {
  cursor: Date;
  rows: ResourceRow[];
  onOpen: (id: string) => void;
  days?: number;
}) {
  const start = useMemo(() => {
    const d = new Date(cursor);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [cursor]);

  const dayList = useMemo(
    () => Array.from({ length: days }, (_, i) => new Date(start.getTime() + i * 86_400_000)),
    [start, days]
  );

  if (rows.length === 0) {
    return (
      <div className="rounded-[12px] border border-dashed border-white/[0.10] bg-white/[0.01] py-12 text-center text-[13px] text-ink-300">
        Keine Fahrzeuge — leg in /flotte das erste an.
      </div>
    );
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="overflow-x-auto rounded-[12px] border border-white/[0.06] bg-white/[0.02]">
      <table className="w-full" style={{ minWidth: 720 }}>
        <thead>
          <tr>
            <th
              className="sticky left-0 z-10 bg-[#16181d] px-2 py-1.5 text-left font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300"
              style={{ minWidth: 140 }}
            >
              Fahrzeug
            </th>
            {dayList.map((d, i) => {
              const iso = d.toISOString().slice(0, 10);
              const isToday = iso === todayIso;
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <th
                  key={i}
                  className={`px-1 py-1.5 text-center font-mono ${
                    isWeekend ? 'text-ink-400' : 'text-ink-300'
                  }`}
                  style={{ minWidth: 32 }}
                >
                  <div className="text-[9px] uppercase tracking-[0.3px]">{DOW[d.getDay()]}</div>
                  <div className={`text-[11px] tabular-nums ${isToday ? 'text-[#5eb6ff] font-medium' : ''}`}>
                    {d.getDate()}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.vehicleId} className="hover:bg-white/[0.02]">
              <td className="sticky left-0 z-10 bg-[#0e0f12] px-2 py-1">
                <Link href={`/flotte/${row.externalId}`} className="block group">
                  <div className="font-mono text-[11.5px] font-medium text-ink-50 group-hover:underline">
                    {row.plate}
                  </div>
                  <div className="truncate text-[10px] text-ink-300">{row.model}</div>
                </Link>
              </td>
              {dayList.map((d, i) => {
                const dayStart = d.getTime();
                const dayEnd = dayStart + 86_400_000;
                const overlapping = row.events.filter((e) => {
                  const s = new Date(e.startsAt).getTime();
                  const en = new Date(e.endsAt).getTime();
                  return en > dayStart && s < dayEnd;
                });
                return (
                  <td key={i} className="relative p-[1px] align-top">
                    <div className="flex h-9 flex-col gap-[1px]">
                      {overlapping.slice(0, 3).map((e) => {
                        const meta = KIND_META[e.kind as keyof typeof KIND_META];
                        return (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => onOpen(e.id)}
                            title={`${meta?.label ?? e.kind} · ${e.title}${e.customerName ? ' · ' + e.customerName : ''}`}
                            className="block w-full overflow-hidden rounded-[1px] px-0.5 text-left text-[8.5px] leading-none transition-opacity hover:opacity-80"
                            style={{
                              background: meta?.color ?? '#9c9c9d',
                              color: '#0a0b0d',
                              flex: '1 1 0',
                            }}
                          >
                            <span className="block truncate">{e.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
