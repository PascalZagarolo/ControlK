import { notFound } from 'next/navigation';
import Link from 'next/link';
import { and, eq, gt, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { getUtilization, getVehicleIncome } from '@/lib/db/queries/vehicle-detail';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function fmtEur(cents?: number | null) {
  if (cents == null) return '—';
  return `€${(cents / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
}

const KIND_LABEL: Record<string, string> = {
  sprinter: 'Sprinter',
  transporter: 'Transporter',
  pkw: 'PKW',
  kuehlfahrzeug: 'Kühlfahrzeug',
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  frei: { label: 'Frei', color: '#5ee08a' },
  vermietet: { label: 'Vermietet', color: '#5eb6ff' },
  wartung: { label: 'Wartung', color: '#ffd96a' },
  reserviert: { label: 'Reserviert', color: '#c084fc' },
};

export default async function PublicVehiclePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getDb();

  const link = await db.query.vehicleShareLinks.findFirst({
    where: and(
      eq(s.vehicleShareLinks.token, token),
      isNotNull(s.vehicleShareLinks.vehicleId),
      or(isNull(s.vehicleShareLinks.expiresAt), gt(s.vehicleShareLinks.expiresAt, new Date()))!
    ),
    with: { vehicle: true, createdBy: true },
  });
  if (!link || !link.vehicle) notFound();

  await db
    .update(s.vehicleShareLinks)
    .set({
      viewCount: sql`${s.vehicleShareLinks.viewCount} + 1`,
      lastViewedAt: new Date(),
    })
    .where(eq(s.vehicleShareLinks.id, link.id));

  const v = link.vehicle;
  const [util, income] = await Promise.all([
    getUtilization(v.id),
    getVehicleIncome(link.workspaceId, v.id, v.monthlyFixedCostsCents ?? 0),
  ]);
  const status = STATUS_META[v.status] ?? STATUS_META.frei;
  const tint = `linear-gradient(140deg, ${status.color}22 0%, ${status.color}08 50%, transparent 100%)`;

  return (
    <div className="relative min-h-screen bg-ink-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[320px]"
        style={{ background: tint }}
      />
      <div className="relative mx-auto flex w-full max-w-[760px] flex-col gap-8 px-4 pb-32 pt-16 md:px-6">
        <header className="flex flex-col gap-4 border-b border-white/[0.06] pb-6">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            <Link href="/" className="hover:text-ink-50">
              uRent
            </Link>
            <span className="opacity-50">·</span>
            <span>Fahrzeug-Page</span>
            {link.expiresAt && (
              <>
                <span className="opacity-50">·</span>
                <span>bis {new Date(link.expiresAt).toLocaleDateString('de-DE')}</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-start gap-4">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-[12px] text-[24px]"
              style={{ background: `${status.color}1f`, color: status.color }}
            >
              ⊞
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex h-5 items-center gap-1 rounded-full px-2 font-mono text-[10px] uppercase tracking-[0.3px]"
                  style={{ background: `${status.color}1f`, color: status.color }}
                >
                  {status.label}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
                  {KIND_LABEL[v.kind] ?? v.kind}
                </span>
              </div>
              <h1 className="mt-1 font-mono text-[34px] font-medium leading-[1.05] tracking-[-0.4px] text-ink-50">
                {v.plate}
              </h1>
              <p className="mt-1 text-[13px] text-ink-200">{v.model}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Kpi label="KM-Stand" value={v.km?.toLocaleString('de-DE') ?? '—'} />
            <Kpi label="Standort" value={v.location ?? '—'} />
            <Kpi label="Tagessatz" value={fmtEur(v.dailyRateCents)} />
          </div>
        </header>

        <section>
          <h2 className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-300">
            Verfügbarkeit · 30 Tage
          </h2>
          <div className="grid grid-cols-30 gap-[2px]" style={{ gridTemplateColumns: 'repeat(30, 1fr)' }}>
            {util.daily.slice(-30).map((status, i) => {
              const color = STATUS_META[status]?.color ?? '#9c9c9d';
              return <span key={i} className="block h-6 rounded-[2px]" style={{ background: color }} />;
            })}
          </div>
          <div className="mt-1.5 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.3px] text-ink-300">
            <span>heute</span>
            <span>+30d</span>
          </div>
        </section>

        <section>
          <h2 className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-300">
            Spezifikationen
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <Kpi label="Letzte HU" value={v.lastInspection ?? '—'} />
            <Kpi label="Nächster Service" value={v.nextService ?? '—'} />
          </div>
        </section>

        <section>
          <h2 className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-300">
            Anfrage
          </h2>
          <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-4 text-[13px] text-ink-200">
            Für Buchungs-Anfragen wende dich an{' '}
            <span className="font-medium text-ink-50">{link.createdBy.name}</span>.
          </div>
        </section>

        <footer className="mt-8 border-t border-white/[0.06] pt-6 text-center text-[11px] text-ink-300">
          Read-only · uRent ·{' '}
          <Link href="/" className="text-ink-100 hover:text-ink-50">
            zur Hauptseite
          </Link>
        </footer>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">{label}</p>
      <p className="mt-0.5 font-mono text-[15px] tabular-nums text-ink-50">{value}</p>
    </div>
  );
}
