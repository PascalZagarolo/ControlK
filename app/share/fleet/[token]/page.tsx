import { notFound } from 'next/navigation';
import Link from 'next/link';
import { and, asc, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';

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

const STATUS_COLOR: Record<string, string> = {
  frei: '#5ee08a',
  vermietet: '#5eb6ff',
  wartung: '#ffd96a',
  reserviert: '#c084fc',
};

export default async function PublicFleetCatalog({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getDb();

  const link = await db.query.vehicleShareLinks.findFirst({
    where: and(
      eq(s.vehicleShareLinks.token, token),
      isNull(s.vehicleShareLinks.vehicleId), // catalog = workspace-wide
      or(isNull(s.vehicleShareLinks.expiresAt), gt(s.vehicleShareLinks.expiresAt, new Date()))!
    ),
    with: { createdBy: true },
  });
  if (!link) notFound();

  await db
    .update(s.vehicleShareLinks)
    .set({
      viewCount: sql`${s.vehicleShareLinks.viewCount} + 1`,
      lastViewedAt: new Date(),
    })
    .where(eq(s.vehicleShareLinks.id, link.id));

  const vehicles = await db.query.vehicles.findMany({
    where: eq(s.vehicles.workspaceId, link.workspaceId),
    orderBy: [asc(s.vehicles.plate)],
  });

  const free = vehicles.filter((v) => v.status === 'frei');
  const other = vehicles.filter((v) => v.status !== 'frei');

  return (
    <div className="min-h-screen bg-ink-900">
      <div className="mx-auto flex w-full max-w-[920px] flex-col gap-8 px-4 pb-32 pt-16 md:px-6">
        <header className="flex flex-col gap-3 border-b border-white/[0.06] pb-6">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            <Link href="/" className="hover:text-ink-50">
              uRent
            </Link>
            <span className="opacity-50">·</span>
            <span>Flotten-Katalog</span>
            {link.expiresAt && (
              <>
                <span className="opacity-50">·</span>
                <span>bis {new Date(link.expiresAt).toLocaleDateString('de-DE')}</span>
              </>
            )}
          </div>
          <h1 className="text-[34px] font-medium leading-[1.05] tracking-[-0.4px] text-ink-50">
            Unsere Flotte
          </h1>
          <p className="text-[13px] text-ink-300">
            {free.length} aktuell verfügbar · {vehicles.length} gesamt · geteilt von{' '}
            <span className="text-ink-100">{link.createdBy.name}</span>
          </p>
        </header>

        {free.length > 0 && (
          <section>
            <h2 className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.4px] text-[#5ee08a]">
              Frei · {free.length}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {free.map((v) => (
                <VehicleTile key={v.id} v={v} />
              ))}
            </div>
          </section>
        )}

        {other.length > 0 && (
          <section>
            <h2 className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-300">
              Aktuell nicht verfügbar · {other.length}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {other.map((v) => (
                <VehicleTile key={v.id} v={v} />
              ))}
            </div>
          </section>
        )}

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

function VehicleTile({ v }: { v: any }) {
  const color = STATUS_COLOR[v.status] ?? '#9c9c9d';
  return (
    <div className="relative flex flex-col gap-2 overflow-hidden rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-4">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
        style={{
          background: `linear-gradient(90deg, ${color} 0%, ${color}55 60%, transparent 100%)`,
        }}
      />
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-[8px] text-[18px]"
          style={{ background: `${color}1f`, color }}
        >
          ⊞
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[15px] font-medium tabular-nums text-ink-50">{v.plate}</p>
          <p className="mt-0.5 truncate text-[11.5px] text-ink-300">
            {v.model} · {KIND_LABEL[v.kind] ?? v.kind}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Kpi label="KM" value={v.km?.toLocaleString('de-DE') ?? '—'} />
        <Kpi label="Tagessatz" value={fmtEur(v.dailyRateCents)} />
      </div>
      {v.location && (
        <p className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
          ⌖ {v.location}
        </p>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[6px] bg-white/[0.02] px-2 py-1.5">
      <p className="font-mono text-[9px] uppercase tracking-[0.3px] text-ink-300">{label}</p>
      <p className="mt-0.5 font-mono text-[12.5px] tabular-nums text-ink-50">{value}</p>
    </div>
  );
}
