'use client';

import Link from 'next/link';
import type { FleetInUseItem } from '@/lib/types';

export function FleetInUseList({ items }: { items: FleetInUseItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed border-white/[0.08] bg-white/[0.01] px-3 py-4 text-center text-[12px] text-ink-300">
        Aktuell kein Fahrzeug in Benutzung.
      </div>
    );
  }
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {items.map((it) => (
        <Link
          key={it.vehicleId}
          href={`/flotte/${it.vehicleId}`}
          className="group flex items-start gap-2.5 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
        >
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-white/[0.04] font-mono text-[10px] uppercase tracking-[0.3px] text-ink-200">
            ⊞
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-ink-50">{it.plate}</span>
            <span className="mt-0.5 block truncate text-[11.5px] text-ink-300">{it.model}</span>
            {it.endsAt && (
              <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.3px] text-[#ffd96a]">
                Rückgabe {new Date(it.endsAt).toLocaleDateString('de-DE')}
              </span>
            )}
          </span>
        </Link>
      ))}
    </div>
  );
}
