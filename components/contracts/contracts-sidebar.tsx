'use client';

export type ContractSmartView =
  | 'all'
  | 'mine'
  | 'aktiv'
  | 'auslaufend'
  | 'expiring30'
  | 'expiring14'
  | 'entwurf'
  | 'storniert'
  | 'vorlagen'
  | 'highValue';

export function ContractsSidebar({
  smartView,
  setSmartView,
  counts,
}: {
  smartView: ContractSmartView;
  setSmartView: (v: ContractSmartView) => void;
  counts: {
    all: number;
    aktiv: number;
    auslaufend: number;
    entwurf: number;
    storniert: number;
    vorlagen: number;
    mine: number;
    expiring30: number;
    expiring14: number;
    highValue: number;
  };
}) {
  const smartViews: { key: ContractSmartView; label: string; count: number; dot: string }[] = [
    { key: 'all', label: 'Alle', count: counts.all, dot: 'bg-ink-300' },
    { key: 'mine', label: 'Mein Portfolio', count: counts.mine, dot: 'bg-[#c084fc]' },
    { key: 'aktiv', label: 'Aktiv', count: counts.aktiv, dot: 'bg-[#5ee08a]' },
    { key: 'expiring14', label: 'Renewal-Cockpit · 14d', count: counts.expiring14, dot: 'bg-[#ff8a8a]' },
    { key: 'expiring30', label: 'Auslaufend · 30d', count: counts.expiring30, dot: 'bg-[#ffd96a]' },
    { key: 'auslaufend', label: 'Status: Auslaufend', count: counts.auslaufend, dot: 'bg-[#ffd96a]' },
    { key: 'entwurf', label: 'Entwürfe', count: counts.entwurf, dot: 'bg-[#9c9c9d]' },
    { key: 'highValue', label: 'High Value (€5k+)', count: counts.highValue, dot: 'bg-[#5eb6ff]' },
    { key: 'vorlagen', label: 'Vorlagen', count: counts.vorlagen, dot: 'bg-[#5eb6ff]' },
    { key: 'storniert', label: 'Storniert', count: counts.storniert, dot: 'bg-ink-400' },
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
