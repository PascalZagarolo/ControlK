import { NextResponse } from 'next/server';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

function escapeICalText(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function formatIcalDate(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = getDb();
  const link = await db.query.calendarShareLinks.findFirst({
    where: and(
      eq(s.calendarShareLinks.token, token),
      or(isNull(s.calendarShareLinks.expiresAt), gt(s.calendarShareLinks.expiresAt, new Date()))!
    ),
  });
  if (!link) return new NextResponse('Not found', { status: 404 });

  const where = link.customerId
    ? and(
        eq(s.calendarEvents.workspaceId, link.workspaceId),
        eq(s.calendarEvents.linkedCustomerId, link.customerId)
      )
    : eq(s.calendarEvents.workspaceId, link.workspaceId);

  const events = await db.query.calendarEvents.findMany({
    where,
    with: {
      customer: { columns: { name: true } },
      vehicle: { columns: { plate: true } },
    },
  });

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//uRent//Calendar//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:uRent',
    'X-WR-TIMEZONE:Europe/Berlin',
  ];

  for (const e of events as any[]) {
    const summary = e.title;
    const desc: string[] = [];
    if (e.detail) desc.push(e.detail);
    if (e.customer?.name) desc.push(`Kunde: ${e.customer.name}`);
    if (e.vehicle?.plate) desc.push(`Fahrzeug: ${e.vehicle.plate}`);
    const location = e.location ?? '';
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@urent.local`,
      `DTSTAMP:${formatIcalDate(new Date())}`,
      `DTSTART:${formatIcalDate(e.startsAt)}`,
      `DTEND:${formatIcalDate(e.endsAt)}`,
      `SUMMARY:${escapeICalText(summary)}`,
      `DESCRIPTION:${escapeICalText(desc.join('\\n'))}`,
      `LOCATION:${escapeICalText(location)}`,
      `CATEGORIES:${e.kind.toUpperCase()}`,
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');

  // Update view count async
  void db
    .update(s.calendarShareLinks)
    .set({
      viewCount: (link.viewCount ?? 0) + 1,
      lastViewedAt: new Date(),
    })
    .where(eq(s.calendarShareLinks.id, link.id));

  const body = lines.join('\r\n');
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="urent.ics"',
      'Cache-Control': 'no-store',
    },
  });
}
