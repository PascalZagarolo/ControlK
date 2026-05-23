'use client';

import type { VehicleHealth } from '@/lib/types';

function colorFor(score: number): string {
  if (score >= 75) return '#5ee08a';
  if (score >= 50) return '#ffd96a';
  if (score >= 25) return '#ffb45e';
  return '#ff8a8a';
}

export function VehicleHealthRing({
  health,
  size = 72,
}: {
  health: VehicleHealth;
  size?: number;
}) {
  const stroke = Math.max(4, Math.round(size / 12));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = (Math.max(0, Math.min(100, health.score)) / 100) * circumference;
  const color = colorFor(health.score);
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[16px] font-medium leading-none" style={{ color }}>
          {health.score}
        </span>
        <span className="mt-0.5 font-mono text-[8.5px] uppercase tracking-[0.3px] text-ink-300">
          Health
        </span>
      </div>
    </div>
  );
}

export function VehicleHealthBreakdown({ health }: { health: VehicleHealth }) {
  const items = [
    { key: 'age', label: 'Alter', value: health.components.age, max: 20 },
    { key: 'km', label: 'KM-Stand', value: health.components.km, max: 20 },
    { key: 'damages', label: 'Schäden', value: health.components.damages, max: 25 },
    { key: 'inspection', label: 'TÜV/HU', value: health.components.inspection, max: 15 },
    { key: 'rating', label: 'Rating', value: health.components.rating, max: 10 },
    { key: 'utilization', label: 'Auslastung', value: health.components.utilization, max: 10 },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((it) => {
        const pct = it.max > 0 ? (it.value / it.max) * 100 : 0;
        return (
          <div key={it.key} className="flex items-center gap-2.5">
            <span className="w-20 font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
              {it.label}
            </span>
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${pct}%`, background: colorFor(pct) }}
              />
            </div>
            <span className="w-12 text-right font-mono text-[10px] tabular-nums text-ink-200">
              {it.value}/{it.max}
            </span>
          </div>
        );
      })}
    </div>
  );
}
