import { notFound } from 'next/navigation';
import Link from 'next/link';
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { Avatar } from '@/components/channel/avatar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function fmtEur(cents: number) {
  return `€${(cents / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  aktiv: { label: 'Aktiv', color: '#5ee08a' },
  auslaufend: { label: 'Auslaufend', color: '#ffd96a' },
  storniert: { label: 'Storniert', color: '#ff8a8a' },
  entwurf: { label: 'Entwurf', color: '#9c9c9d' },
  vorlage: { label: 'Vorlage', color: '#7d7d7d' },
};

export default async function CustomerSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getDb();

  const link = await db.query.customerShareLinks.findFirst({
    where: and(
      eq(s.customerShareLinks.token, token),
      or(isNull(s.customerShareLinks.expiresAt), gt(s.customerShareLinks.expiresAt, new Date()))!
    ),
    with: {
      customer: {
        with: {
          contacts: true,
          contracts: true,
        },
      },
      createdBy: true,
    },
  });
  if (!link) notFound();

  // Increment view
  await db
    .update(s.customerShareLinks)
    .set({
      viewCount: sql`${s.customerShareLinks.viewCount} + 1`,
      lastViewedAt: new Date(),
    })
    .where(eq(s.customerShareLinks.id, link.id));

  const customer = link.customer;
  const activeContracts = customer.contracts.filter(
    (c: any) => c.status === 'aktiv' || c.status === 'auslaufend'
  );
  const totalCents = activeContracts.reduce(
    (acc: number, c: any) => acc + (c.valueCents ?? 0),
    0
  );

  // Fleet in use (current)
  const now = new Date();
  const fleet = await db
    .select({
      id: s.vehicles.id,
      plate: s.vehicles.plate,
      model: s.vehicles.model,
      startsAt: s.calendarEvents.startsAt,
      endsAt: s.calendarEvents.endsAt,
    })
    .from(s.calendarEvents)
    .innerJoin(s.vehicles, eq(s.calendarEvents.linkedVehicleId, s.vehicles.id))
    .where(
      and(
        eq(s.calendarEvents.linkedCustomerId, customer.id),
        sql`${s.calendarEvents.startsAt} <= ${now}`,
        sql`${s.calendarEvents.endsAt} > ${now}`
      )
    );

  const upcomingEvents = await db.query.calendarEvents.findMany({
    where: and(
      eq(s.calendarEvents.linkedCustomerId, customer.id),
      sql`${s.calendarEvents.startsAt} >= ${now}`
    ),
    orderBy: [s.calendarEvents.startsAt],
    limit: 10,
  });

  const tint = `linear-gradient(140deg, ${customer.fromColor}26 0%, ${customer.toColor}10 50%, transparent 100%)`;

  return (
    <div className="relative min-h-screen bg-ink-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[300px]"
        style={{ background: tint }}
      />
      <div className="relative mx-auto flex w-full max-w-[760px] flex-col gap-8 px-4 pb-32 pt-16 md:px-6">
        <header className="flex flex-col gap-4 border-b border-white/[0.06] pb-6">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            <Link href="/" className="transition-colors hover:text-ink-50">
              uRent
            </Link>
            <span className="opacity-50">·</span>
            <span>Kundenportal</span>
            {link.expiresAt && (
              <>
                <span className="opacity-50">·</span>
                <span>bis {new Date(link.expiresAt).toLocaleDateString('de-DE')}</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-start gap-4">
            <Avatar
              initials={customer.initials}
              from={customer.fromColor}
              to={customer.toColor}
              size={56}
            />
            <div className="min-w-0 flex-1">
              <h1 className="text-[34px] font-medium leading-[1.05] tracking-[-0.4px] text-ink-50">
                {customer.name}
              </h1>
              {customer.industry && (
                <p className="mt-1 text-[13px] text-ink-300">{customer.industry}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Kpi label="Aktive Verträge" value={String(activeContracts.length)} />
            <Kpi label="Gesamtwert" value={fmtEur(totalCents)} />
            <Kpi label="Fahrzeuge" value={String(fleet.length)} />
          </div>
        </header>

        {fleet.length > 0 && (
          <section>
            <h2 className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-300">
              Aktuell vermietet · {fleet.length}
            </h2>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {fleet.map((v) => (
                <div
                  key={v.id}
                  className="flex items-start gap-2.5 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-white/[0.04] font-mono text-[10px] uppercase tracking-[0.3px] text-ink-200">
                    ⊞
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink-50">
                      {v.plate}
                    </span>
                    <span className="mt-0.5 block truncate text-[11.5px] text-ink-300">
                      {v.model}
                    </span>
                    {v.endsAt && (
                      <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.3px] text-[#ffd96a]">
                        Rückgabe {v.endsAt.toLocaleDateString('de-DE')}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeContracts.length > 0 && (
          <section>
            <h2 className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-300">
              Verträge · {activeContracts.length}
            </h2>
            <div className="flex flex-col gap-1.5">
              {activeContracts.map((c: any) => {
                const meta = STATUS_META[c.status] ?? STATUS_META.entwurf;
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-2.5 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                  >
                    <span
                      className="font-mono text-[10px] uppercase tracking-[0.3px]"
                      style={{ color: meta.color }}
                    >
                      {meta.label}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-50">
                      {c.title}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-ink-200">
                      {c.valueCents ? fmtEur(c.valueCents) : '—'}
                    </span>
                    {c.endsAt && (
                      <span className="font-mono text-[10px] text-ink-300">
                        bis {c.endsAt.toLocaleDateString('de-DE')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {upcomingEvents.length > 0 && (
          <section>
            <h2 className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-300">
              Anstehende Termine · {upcomingEvents.length}
            </h2>
            <div className="flex flex-col gap-1.5">
              {upcomingEvents.map((e: any) => (
                <div
                  key={e.id}
                  className="flex items-center gap-2.5 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-[#c084fc]">
                    {e.kind}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink-100">
                    {e.title}
                  </span>
                  <span className="font-mono text-[11px] text-ink-300">
                    {new Date(e.startsAt).toLocaleString('de-DE', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="mt-8 border-t border-white/[0.06] pt-6 text-center text-[11px] text-ink-300">
          Read-only Ansicht · von{' '}
          <span className="text-ink-100">{link.createdBy.name}</span> geteilt ·{' '}
          <Link href="/" className="text-ink-100 hover:text-ink-50">
            uRent
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
      <p className="mt-0.5 font-mono text-[18px] tabular-nums text-ink-50">{value}</p>
    </div>
  );
}
