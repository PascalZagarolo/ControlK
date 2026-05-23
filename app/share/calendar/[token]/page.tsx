import { notFound } from 'next/navigation';
import Link from 'next/link';
import { and, asc, eq, gt, gte, isNull, lte, or, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { KIND_META } from '@/components/calendar/event-color';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PublicCalendarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getDb();

  const link = await db.query.calendarShareLinks.findFirst({
    where: and(
      eq(s.calendarShareLinks.token, token),
      or(isNull(s.calendarShareLinks.expiresAt), gt(s.calendarShareLinks.expiresAt, new Date()))!
    ),
    with: { customer: true, createdBy: true },
  });
  if (!link) notFound();

  await db
    .update(s.calendarShareLinks)
    .set({
      viewCount: sql`${s.calendarShareLinks.viewCount} + 1`,
      lastViewedAt: new Date(),
    })
    .where(eq(s.calendarShareLinks.id, link.id));

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 3, 0);

  const where: any = [
    eq(s.calendarEvents.workspaceId, link.workspaceId),
    gte(s.calendarEvents.endsAt, from),
    lte(s.calendarEvents.startsAt, to),
  ];
  if (link.customerId) where.push(eq(s.calendarEvents.linkedCustomerId, link.customerId));

  const events = await db.query.calendarEvents.findMany({
    where: and(...where),
    orderBy: [asc(s.calendarEvents.startsAt)],
    with: {
      customer: { columns: { name: true } },
      vehicle: { columns: { plate: true, model: true } },
    },
  });

  // Group by day
  const groups = new Map<string, any[]>();
  for (const e of events) {
    const day = e.startsAt.toISOString().slice(0, 10);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(e);
  }
  const sortedDays = Array.from(groups.keys()).sort();
  const todayIso = new Date().toISOString().slice(0, 10);

  const icalUrl = `/api/ical/${token}`;

  return (
    <div className="min-h-screen bg-ink-900">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-8 px-4 pb-32 pt-16 md:px-6">
        <header className="flex flex-col gap-3 border-b border-white/[0.06] pb-6">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            <Link href="/" className="hover:text-ink-50">
              uRent
            </Link>
            <span className="opacity-50">·</span>
            <span>Kalender</span>
            {link.expiresAt && (
              <>
                <span className="opacity-50">·</span>
                <span>bis {new Date(link.expiresAt).toLocaleDateString('de-DE')}</span>
              </>
            )}
          </div>
          <h1 className="text-[32px] font-medium leading-[1.1] tracking-[-0.4px] text-ink-50">
            {link.customerId && link.customer?.name
              ? `${link.customer.name} — Termine`
              : 'Anstehende Termine'}
          </h1>
          <p className="text-[12.5px] text-ink-300">
            geteilt von <span className="text-ink-100">{link.createdBy?.name ?? '—'}</span> · {events.length} Termine
          </p>
          <a
            href={icalUrl}
            className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#5eb6ff]/30 bg-[#5eb6ff]/[0.06] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.3px] text-[#5eb6ff] hover:bg-[#5eb6ff]/[0.10]"
          >
            📅 In Kalender abonnieren (iCal)
          </a>
        </header>

        {sortedDays.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-white/[0.10] bg-white/[0.01] py-12 text-center text-[13px] text-ink-300">
            Keine anstehenden Termine.
          </div>
        ) : (
          sortedDays.map((day) => {
            const items = groups.get(day) ?? [];
            const isToday = day === todayIso;
            return (
              <section key={day}>
                <h3
                  className={`mb-2 font-mono text-[10.5px] uppercase tracking-[0.4px] ${
                    isToday ? 'text-[#5eb6ff]' : 'text-ink-300'
                  }`}
                >
                  {new Date(day).toLocaleDateString('de-DE', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                  })}
                </h3>
                <div className="flex flex-col gap-1.5">
                  {items.map((e: any) => {
                    const meta = KIND_META[e.kind as keyof typeof KIND_META];
                    const s = new Date(e.startsAt);
                    const en = new Date(e.endsAt);
                    return (
                      <div
                        key={e.id}
                        className="flex items-center gap-3 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                      >
                        <span
                          className="font-mono text-[11px] uppercase tracking-[0.3px]"
                          style={{ color: meta.color }}
                        >
                          {s.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span
                          className="inline-flex h-5 items-center gap-1 rounded-full px-2 font-mono text-[10px] uppercase tracking-[0.3px]"
                          style={{ background: `${meta.color}1f`, color: meta.color }}
                        >
                          {meta.label}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-ink-50">
                            {e.title}
                          </span>
                          {(e.vehicle?.plate || e.customer?.name || e.location) && (
                            <span className="mt-0.5 block text-[11px] text-ink-300">
                              {[
                                e.customer?.name && `◉ ${e.customer.name}`,
                                e.vehicle?.plate && `⊞ ${e.vehicle.plate}`,
                                e.location && `⌖ ${e.location}`,
                              ]
                                .filter(Boolean)
                                .join('  ·  ')}
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-[10px] text-ink-300">
                          {Math.round((en.getTime() - s.getTime()) / 60_000)} min
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
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
