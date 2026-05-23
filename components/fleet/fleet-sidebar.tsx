'use client';

import { VehicleTagBadge } from './vehicle-tag-picker';
import type { VehicleKind, VehicleTag } from '@/lib/types';

export type FleetSmartView =
  | 'all'
  | 'mine'
  | 'frei'
  | 'vermietet'
  | 'wartung'
  | 'reserviert'
  | 'serviceDue'
  | 'topPerformer'
  | 'damageHotspot';

const KIND_LABEL: Record<VehicleKind, string> = {
  sprinter: 'Sprinter',
  transporter: 'Transporter',
  pkw: 'PKW',
  kuehlfahrzeug: 'Kühlfahrzeug',
};

export function FleetSidebar({
  smartView,
  setSmartView,
  counts,
  tags,
  activeTagSlug,
  setActiveTagSlug,
  activeKind,
  setActiveKind,
}: {
  smartView: FleetSmartView;
  setSmartView: (v: FleetSmartView) => void;
  counts: {
    all: number;
    mine: number;
    frei: number;
    vermietet: number;
    wartung: number;
    reserviert: number;
    serviceDue: number;
  };
  tags: VehicleTag[];
  activeTagSlug: string | null;
  setActiveTagSlug: (slug: string | null) => void;
  activeKind: VehicleKind | null;
  setActiveKind: (kind: VehicleKind | null) => void;
}) {
  const smartViews: { key: FleetSmartView; label: string; count: number; dot: string }[] = [
    { key: 'all', label: 'Alle', count: counts.all, dot: 'bg-ink-300' },
    { key: 'mine', label: 'Mein Portfolio', count: counts.mine, dot: 'bg-[#c084fc]' },
    { key: 'frei', label: 'Frei', count: counts.frei, dot: 'bg-[#5ee08a]' },
    { key: 'vermietet', label: 'Vermietet', count: counts.vermietet, dot: 'bg-[#5eb6ff]' },
    { key: 'wartung', label: 'Wartung', count: counts.wartung, dot: 'bg-[#ffd96a]' },
    { key: 'reserviert', label: 'Reserviert', count: counts.reserviert, dot: 'bg-[#c084fc]' },
    { key: 'serviceDue', label: 'Service fällig', count: counts.serviceDue, dot: 'bg-[#ff8a8a]' },
    { key: 'topPerformer', label: 'Top-Performer', count: 0, dot: 'bg-[#5ee08a]' },
    { key: 'damageHotspot', label: 'Schaden-Hotspots', count: 0, dot: 'bg-[#ff8a8a]' },
  ];

  const kinds: VehicleKind[] = ['sprinter', 'transporter', 'pkw', 'kuehlfahrzeug'];

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
                className={`group flex items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-left text-[13px] leading-tight transition-colors duration-150 ${
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

        <SectionLabel>Fahrzeug-Art</SectionLabel>
        <div className="flex flex-wrap gap-1 px-1">
          <button
            type="button"
            onClick={() => setActiveKind(null)}
            className={`rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.3px] transition-colors ${
              activeKind == null
                ? 'border-white/15 bg-white/[0.08] text-ink-50'
                : 'border-white/[0.06] bg-white/[0.02] text-ink-300 hover:text-ink-50'
            }`}
          >
            Alle
          </button>
          {kinds.map((k) => {
            const active = activeKind === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setActiveKind(active ? null : k)}
                className={`rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.3px] transition-colors ${
                  active
                    ? 'border-white/15 bg-white/[0.08] text-ink-50'
                    : 'border-white/[0.06] bg-white/[0.02] text-ink-300 hover:text-ink-50'
                }`}
              >
                {KIND_LABEL[k]}
              </button>
            );
          })}
        </div>

        {tags.length > 0 && (
          <>
            <SectionLabel>Tags</SectionLabel>
            <div className="flex flex-wrap gap-1 px-1">
              <button
                type="button"
                onClick={() => setActiveTagSlug(null)}
                className={`rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.3px] transition-colors ${
                  activeTagSlug == null
                    ? 'border-white/15 bg-white/[0.08] text-ink-50'
                    : 'border-white/[0.06] bg-white/[0.02] text-ink-300 hover:text-ink-50'
                }`}
              >
                Alle
              </button>
              {tags.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTagSlug(t.slug === activeTagSlug ? null : t.slug)}
                  className={`transition-opacity ${
                    activeTagSlug && activeTagSlug !== t.slug ? 'opacity-40' : ''
                  }`}
                >
                  <VehicleTagBadge tag={t} />
                </button>
              ))}
            </div>
          </>
        )}
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
