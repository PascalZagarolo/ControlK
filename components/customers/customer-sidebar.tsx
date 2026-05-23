'use client';

import { TagBadge } from './tag-badge';
import type { CustomerTag } from '@/lib/types';

type SmartView = {
  key: 'all' | 'mine' | 'active' | 'lead' | 'inactive' | 'risk' | 'quiet' | 'expiring' | 'onboarding';
  label: string;
  count: number;
  dot: string;
};

export function CustomerSidebar({
  smartView,
  setSmartView,
  counts,
  tags,
  activeTagSlug,
  setActiveTagSlug,
}: {
  smartView: SmartView['key'];
  setSmartView: (v: SmartView['key']) => void;
  counts: {
    all: number;
    mine: number;
    active: number;
    lead: number;
    inactive: number;
    risk: number;
    quiet: number;
    expiring: number;
    onboarding: number;
  };
  tags: CustomerTag[];
  activeTagSlug: string | null;
  setActiveTagSlug: (slug: string | null) => void;
}) {
  const smartViews: SmartView[] = [
    { key: 'all', label: 'Alle', count: counts.all, dot: 'bg-ink-300' },
    { key: 'mine', label: 'Mein Portfolio', count: counts.mine, dot: 'bg-[#c084fc]' },
    { key: 'active', label: 'Aktiv', count: counts.active, dot: 'bg-[#5ee08a]' },
    { key: 'lead', label: 'Lead', count: counts.lead, dot: 'bg-[#5eb6ff]' },
    { key: 'risk', label: 'Risiko', count: counts.risk, dot: 'bg-[#ff8a8a]' },
    { key: 'quiet', label: 'Stumm seit 14d', count: counts.quiet, dot: 'bg-[#ffd96a]' },
    { key: 'expiring', label: 'Auslaufend', count: counts.expiring, dot: 'bg-[#ffb45e]' },
    { key: 'onboarding', label: 'Onboarding', count: counts.onboarding, dot: 'bg-[#5eb6ff]' },
    { key: 'inactive', label: 'Inaktiv', count: counts.inactive, dot: 'bg-ink-400' },
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
                  <TagBadge tag={t} />
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
