'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateVehicleField } from '@/lib/actions/vehicles';
import type { VehiclePricing } from '@/lib/types';

function fmtEur(cents?: number | null) {
  if (cents == null) return '—';
  return `€${(cents / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
}

export function PricingCalculator({
  vehicleId,
  pricing,
}: {
  vehicleId: string;
  pricing: VehiclePricing;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [daily, setDaily] = useState(
    pricing.dailyRateCents != null ? String(pricing.dailyRateCents / 100) : ''
  );
  const [weekend, setWeekend] = useState(
    pricing.weekendSurchargeCents != null ? String(pricing.weekendSurchargeCents / 100) : ''
  );
  const [days, setDays] = useState(3);
  const [weekendDays, setWeekendDays] = useState(0);

  useEffect(() => {
    setDaily(pricing.dailyRateCents != null ? String(pricing.dailyRateCents / 100) : '');
    setWeekend(
      pricing.weekendSurchargeCents != null ? String(pricing.weekendSurchargeCents / 100) : ''
    );
  }, [pricing.dailyRateCents, pricing.weekendSurchargeCents]);

  const dailyCents = useMemo(() => (parseFloat(daily) || 0) * 100, [daily]);
  const weekendCents = useMemo(() => (parseFloat(weekend) || 0) * 100, [weekend]);
  const total = dailyCents * days + weekendCents * weekendDays;

  const persist = (field: 'dailyRateCents' | 'weekendSurchargeCents', value: string) => {
    const cents = parseInt(value.replace(/[^\d.]/g, ''), 10) * 100 || 0;
    start(async () => {
      await updateVehicleField({ vehicleId, field, value: String(cents) });
      router.refresh();
    });
  };

  return (
    <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          Pricing-Rechner
        </span>
        {pending && (
          <span className="font-mono text-[10px] text-ink-300">speichere …</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="font-mono text-[9.5px] uppercase tracking-[0.3px] text-ink-300">
            Tagessatz €
          </label>
          <input
            type="number"
            value={daily}
            onChange={(e) => setDaily(e.target.value)}
            onBlur={() => persist('dailyRateCents', daily)}
            placeholder="120"
            className="mt-1 block w-full rounded-[6px] border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[13px] text-ink-50 outline-none focus:border-white/[0.20]"
          />
        </div>
        <div>
          <label className="font-mono text-[9.5px] uppercase tracking-[0.3px] text-ink-300">
            Wochenend-Aufschlag €
          </label>
          <input
            type="number"
            value={weekend}
            onChange={(e) => setWeekend(e.target.value)}
            onBlur={() => persist('weekendSurchargeCents', weekend)}
            placeholder="40"
            className="mt-1 block w-full rounded-[6px] border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[13px] text-ink-50 outline-none focus:border-white/[0.20]"
          />
        </div>
      </div>

      <div className="my-3 border-t border-white/[0.06]" />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="font-mono text-[9.5px] uppercase tracking-[0.3px] text-ink-300">
            Mietdauer (Tage)
          </label>
          <input
            type="number"
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value) || 0)}
            min={1}
            className="mt-1 block w-full rounded-[6px] border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[13px] text-ink-50 outline-none focus:border-white/[0.20]"
          />
        </div>
        <div>
          <label className="font-mono text-[9.5px] uppercase tracking-[0.3px] text-ink-300">
            davon Wochenende
          </label>
          <input
            type="number"
            value={weekendDays}
            onChange={(e) => setWeekendDays(parseInt(e.target.value) || 0)}
            min={0}
            max={days}
            className="mt-1 block w-full rounded-[6px] border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[13px] text-ink-50 outline-none focus:border-white/[0.20]"
          />
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between rounded-[8px] bg-white/[0.03] px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          Total
        </span>
        <span className="font-mono text-[20px] tabular-nums text-ink-50">{fmtEur(total)}</span>
      </div>
    </div>
  );
}
