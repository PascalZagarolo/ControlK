'use client';

import type { Booking } from '@/lib/types';

const COLOR: Record<Booking['status'], string> = {
  frei: '#5ee08a',
  vermietet: '#5eb6ff',
  wartung: '#ffd96a',
  reserviert: '#c084fc',
};

export function BookingStripe({ bookings }: { bookings: Booking[] }) {
  if (bookings.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed border-white/[0.08] bg-white/[0.01] py-4 text-center text-[12px] text-ink-300">
        Keine Buchungen geplant.
      </div>
    );
  }
  return (
    <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          Buchungen · nächste 30 Tage
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
      <div className="grid grid-cols-30 gap-[2px]" style={{ gridTemplateColumns: 'repeat(30, 1fr)' }}>
        {bookings.map((b, i) => (
          <span
            key={i}
            title={`${new Date(b.date).toLocaleDateString('de-DE')}: ${b.status}${b.label ? ' · ' + b.label : ''}`}
            className="block h-6 rounded-[2px]"
            style={{ background: COLOR[b.status] }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.3px] text-ink-300">
        <span>heute</span>
        <span>+30d</span>
      </div>
    </div>
  );
}
