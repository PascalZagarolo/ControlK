'use client';

import { useEffect, useState } from 'react';

type EmbedKind = 'brief' | 'pipeline' | 'fleet';

export function EmbedRenderer({ kind }: { kind: EmbedKind }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/notes/embeds/${kind}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  if (loading) {
    return (
      <div className="my-3 rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[12px] text-ink-300">
        Lade Live-Embed …
      </div>
    );
  }

  if (!data?.ok) {
    return (
      <div className="my-3 rounded-[12px] border border-[#ff8a8a]/30 bg-[#ff8a8a]/[0.05] px-4 py-3 text-[12px] text-[#ff8a8a]">
        Embed konnte nicht geladen werden.
      </div>
    );
  }

  return (
    <div className="my-3 flex flex-col gap-3 rounded-[12px] border border-[#5eb6ff]/25 bg-[#5eb6ff]/[0.04] px-4 py-3">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.4px] text-[#5eb6ff]">
        <span>⌬</span>
        <span>{data.title}</span>
        <span className="ml-auto text-ink-300">
          live · {new Date(data.freshAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {kind === 'brief' && <BriefEmbed brief={data.brief} />}
      {kind === 'pipeline' && <PipelineEmbed data={data} />}
      {kind === 'fleet' && <FleetEmbed data={data} />}
    </div>
  );
}

function BriefEmbed({ brief }: { brief: any }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13.5px] leading-[1.55] text-ink-100">
        {brief.greeting}. {brief.intro}
      </p>
      {brief.sections?.slice(0, 3).map((sec: any, i: number) => (
        <p key={i} className="text-[12px] leading-[1.5] text-ink-300">
          {sec.kind === 'overdue' && `Überfällig: ${sec.items.slice(0, 3).map((t: any) => t.title).join(', ')}.`}
          {sec.kind === 'today' && `Heute: ${sec.items.slice(0, 3).map((t: any) => t.title).join(', ')}.`}
          {sec.kind === 'silent-customers' && `Kunden warten: ${sec.entries.slice(0, 2).map((c: any) => c.name).join(', ')}.`}
          {sec.kind === 'expiring-contracts' && `Verträge auslaufen: ${sec.entries.slice(0, 2).map((c: any) => c.title).join(', ')}.`}
        </p>
      ))}
    </div>
  );
}

function PipelineEmbed({ data }: { data: any }) {
  const total = data.stages.reduce((a: number, s: any) => a + s.count, 0);
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {data.stages.map((st: any) => (
          <div
            key={st.key}
            className="flex flex-col gap-0.5 rounded-[8px] bg-white/[0.04] px-2.5 py-2"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
              {st.label}
            </span>
            <span className="font-mono text-[20px] tabular-nums text-ink-50">{st.count}</span>
            {st.samples?.length > 0 && (
              <span className="truncate text-[10.5px] text-ink-300">
                {st.samples.slice(0, 2).join(' · ')}
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-ink-300">
        Gesamt {total} Kunden · {data.openContractCount} offene Verträge
      </p>
    </div>
  );
}

function FleetEmbed({ data }: { data: any }) {
  if (data.empty) {
    return (
      <p className="text-[12px] text-ink-300">
        Noch keine Fahrzeuge im Workspace.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <div className="flex flex-col">
          <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            Ø Auslastung
          </span>
          <span className="font-mono text-[20px] tabular-nums text-ink-50">
            {Math.round((data.avgUtilization ?? 0) * 100)}%
          </span>
        </div>
        <div className="flex flex-col">
          <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            Peak
          </span>
          <span className="font-mono text-[13.5px] text-ink-100">
            {new Date(data.peakDay.date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' })}
            {' · '}
            +{data.peakDay.markup}%
          </span>
        </div>
        <div className="flex flex-col">
          <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            Flotte
          </span>
          <span className="font-mono text-[20px] tabular-nums text-ink-50">{data.totalVehicles}</span>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {data.days.slice(0, 7).map((d: any) => {
          const tone =
            d.recommendedMarkupPct >= 20
              ? { bg: '#ff8a8a26', color: '#ff8a8a' }
              : d.recommendedMarkupPct >= 10
                ? { bg: '#ffd96a26', color: '#ffd96a' }
                : { bg: '#5ee08a14', color: '#5ee08a' };
          const dt = new Date(d.date);
          return (
            <div
              key={d.date}
              className="flex flex-col items-center rounded-[6px] px-1 py-1"
              style={{ background: tone.bg }}
              title={`${d.bookedCount}/${d.totalCount} · +${d.recommendedMarkupPct}%`}
            >
              <span className="font-mono text-[9px] text-ink-300">
                {dt.toLocaleDateString('de-DE', { weekday: 'short' }).slice(0, 2)}
              </span>
              <span className="font-mono text-[11px]" style={{ color: tone.color }}>
                {Math.round(d.utilization * 100)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
