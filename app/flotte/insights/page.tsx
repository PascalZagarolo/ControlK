import { redirect } from 'next/navigation';
import Link from 'next/link';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import {
  getFleetOccupancyForecast,
  rollUpInsights,
} from '@/lib/db/queries/fleet-occupancy';

export const dynamic = 'force-dynamic';

function fmtRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const f = (d: Date) =>
    d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
  if (start === end) return f(s);
  return `${f(s)} – ${f(e)}`;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' });
}

function tone(markup: number) {
  if (markup >= 25) return { color: '#ff8a8a', bg: '#ff8a8a26' };
  if (markup >= 15) return { color: '#ffd96a', bg: '#ffd96a26' };
  if (markup >= 5) return { color: '#5eb6ff', bg: '#5eb6ff26' };
  return { color: '#5ee08a', bg: '#5ee08a14' };
}

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/flotte/insights');
  const ws = await requireCurrentWorkspace();

  const days = await getFleetOccupancyForecast(ws.id, 30);
  const insights = rollUpInsights(days);

  if (days.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-[920px] flex-col gap-6 px-4 pb-32 pt-28 md:px-6">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            Flotten-Insights
          </span>
          <h1 className="mt-1 text-[28px] font-medium leading-[1.15] tracking-[-0.3px] text-ink-50">
            Noch keine Fahrzeuge im Workspace.
          </h1>
          <p className="mt-2 text-[14px] text-ink-300">
            Lege ein Fahrzeug an, dann zeigen wir hier Auslastungs-Forecast und
            Pricing-Empfehlungen.
          </p>
          <Link
            href="/flotte"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-ink-200 hover:bg-white/[0.05] hover:text-ink-50"
          >
            → Zur Flotte
          </Link>
        </div>
      </div>
    );
  }

  const totalVehicles = days[0].totalCount;
  const avgUtil = days.reduce((a, b) => a + b.utilization, 0) / days.length;
  const peakDay = days.reduce((a, b) => (b.utilization > a.utilization ? b : a));
  const lowDay = days.reduce((a, b) => (b.utilization < a.utilization ? b : a));

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-8 px-4 pb-32 pt-28 md:px-6">
      {/* Headline */}
      <div>
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          Flotten-Insights · 30 Tage
        </span>
        <h1 className="mt-1 text-[28px] font-medium leading-[1.15] tracking-[-0.3px] text-ink-50">
          Auslastung und Pricing-Empfehlungen.
        </h1>
        <p className="mt-2 text-[14px] leading-[1.55] text-ink-200">
          Basierend auf {totalVehicles} Fahrzeugen, deinen aktuellen Verträgen und
          deutschen Feiertagen.{' '}
          <span className="text-ink-300">
            Empfehlungen sind heuristisch — Endpreis-Entscheidung bleibt bei dir.
          </span>
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Ø Auslastung" value={`${Math.round(avgUtil * 100)}%`} />
        <Kpi
          label="Peak"
          value={`${Math.round(peakDay.utilization * 100)}%`}
          sub={dayLabel(peakDay.date)}
        />
        <Kpi
          label="Tief"
          value={`${Math.round(lowDay.utilization * 100)}%`}
          sub={dayLabel(lowDay.date)}
        />
      </div>

      {/* Insights */}
      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-300">
          Pricing-Empfehlungen · {insights.length}
        </h2>
        {insights.length === 0 ? (
          <p className="rounded-[12px] border border-dashed border-white/[0.10] bg-white/[0.01] px-4 py-6 text-center text-[13px] text-ink-300">
            Keine Pricing-Windows in den nächsten 30 Tagen. Auslastung ist
            entspannt — keine Markup-Empfehlung.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {insights.map((ins, i) => {
              const t = tone(ins.recommendedMarkupPct);
              return (
                <div
                  key={i}
                  className="flex items-center gap-4 rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                >
                  <span
                    className="flex h-12 w-16 shrink-0 flex-col items-center justify-center rounded-[8px] font-mono"
                    style={{ background: t.bg, color: t.color }}
                  >
                    <span className="text-[18px] font-medium leading-none">
                      +{ins.recommendedMarkupPct}%
                    </span>
                    <span className="mt-0.5 text-[9px] uppercase tracking-[0.3px] opacity-80">
                      Markup
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium text-ink-50">
                      {fmtRange(ins.windowStart, ins.windowEnd)}
                    </p>
                    <p className="mt-0.5 text-[12px] leading-[1.45] text-ink-300">
                      {ins.reason} · Ø {Math.round(ins.avgUtilization * 100)}% gebucht
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Heatmap */}
      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-300">
          Heatmap · pro Tag
        </h2>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const t = tone(d.recommendedMarkupPct);
            const dt = new Date(d.date);
            return (
              <div
                key={d.date}
                className="relative flex aspect-square flex-col items-center justify-center rounded-[8px] border border-white/[0.06] p-1"
                style={{
                  background: d.utilization > 0 ? t.bg : 'transparent',
                }}
                title={`${dayLabel(d.date)} — ${d.bookedCount}/${d.totalCount} (${Math.round(
                  d.utilization * 100
                )}%) → +${d.recommendedMarkupPct}%${d.holidayName ? ` · ${d.holidayName}` : ''}`}
              >
                <span className="font-mono text-[9px] uppercase tracking-[0.3px] text-ink-300">
                  {dt.toLocaleDateString('de-DE', { weekday: 'short' }).slice(0, 2)}
                </span>
                <span className="text-[14px] font-medium leading-none text-ink-50">
                  {dt.getDate()}
                </span>
                <span
                  className="mt-0.5 font-mono text-[8.5px]"
                  style={{ color: t.color }}
                >
                  {d.bookedCount > 0
                    ? `${Math.round(d.utilization * 100)}%`
                    : '·'}
                </span>
                {d.isHoliday && (
                  <span className="absolute right-1 top-1 text-[8px]">★</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
          <Legend color="#5ee08a" label="0–10% · entspannt" />
          <Legend color="#5eb6ff" label="10–15% · normal" />
          <Legend color="#ffd96a" label="15–25% · Peak" />
          <Legend color="#ff8a8a" label="25%+ · Premium" />
          <span className="ml-auto">★ Feiertag / Brücke</span>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
        {label}
      </span>
      <span className="text-[22px] font-medium leading-none text-ink-50">{value}</span>
      {sub && <span className="text-[11px] text-ink-300">{sub}</span>}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      <span>{label}</span>
    </span>
  );
}
