import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import {
  getCalendarConflicts,
  getDayDensity,
  getPreFlightAlerts,
  getResourceRows,
  getYearHeatmap,
  listCalendarEvents,
  listCalendarTemplates,
  smartCalendarCounts,
} from '@/lib/db/queries/calendar';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { asc, eq } from 'drizzle-orm';
import { listWorkspaceMembers } from '@/lib/db/queries/members';
import { listStandstills } from '@/lib/db/queries/inverse-calendar';
import { listExternalEventsInRange } from '@/lib/db/queries/external-calendar';
import { listTodos } from '@/lib/db/queries/todos';
import type { CalendarEvent } from '@/lib/types';
import { KalenderClient } from '@/components/calendar/kalender-client';

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/kalender');
  const ws = await requireCurrentWorkspace();

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 4, 0);

  const db = getDb();
  const [
    events,
    density,
    yearDensity,
    conflicts,
    alerts,
    resourceRows,
    templates,
    counts,
    customers,
    vehicles,
    contracts,
    members,
    standstills,
    externalEvents,
    todosForCal,
  ] = await Promise.all([
    listCalendarEvents(ws.id, from, to),
    getDayDensity(
      ws.id,
      new Date(now.getFullYear(), now.getMonth() - 1, 1),
      new Date(now.getFullYear(), now.getMonth() + 2, 0)
    ),
    getYearHeatmap(ws.id),
    getCalendarConflicts(ws.id, from, to),
    getPreFlightAlerts(ws.id),
    getResourceRows(
      ws.id,
      new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14)
    ),
    listCalendarTemplates(ws.id),
    smartCalendarCounts(ws.id),
    db.query.customers.findMany({
      where: eq(s.customers.workspaceId, ws.id),
      columns: { id: true, name: true },
      orderBy: [asc(s.customers.name)],
    }),
    db.query.vehicles.findMany({
      where: eq(s.vehicles.workspaceId, ws.id),
      columns: { id: true, externalId: true, plate: true, model: true },
      orderBy: [asc(s.vehicles.plate)],
    }),
    db.query.contracts.findMany({
      where: eq(s.contracts.workspaceId, ws.id),
      columns: { id: true, title: true, customerId: true },
      orderBy: [asc(s.contracts.title)],
    }),
    listWorkspaceMembers(ws.id),
    listStandstills(user.id),
    listExternalEventsInRange(user.id, from, to),
    listTodos(ws.id, user.id),
  ]);

  // Unified layers: fold the read-only Google mirror and due-dated todos into
  // the same event stream so one day shows everything. They carry a `source`
  // so the client can toggle layers and keep them non-editable.
  const googleEvents: CalendarEvent[] = externalEvents.map((e) => ({
    id: `ext_${e.id}`,
    kind: 'meeting',
    title: e.title,
    startsAt: e.startAt,
    endsAt: e.endAt,
    location: e.location ?? undefined,
    checklist: [],
    attendees: [],
    source: 'google',
  }));
  const todoEvents: CalendarEvent[] = todosForCal
    .filter((t) => t.dueAt && t.status !== 'erledigt' && t.status !== 'abgebrochen')
    .map((t) => {
      const start = new Date(t.dueAt as string);
      return {
        id: `todo_${t.id}`,
        kind: 'task',
        title: t.title,
        startsAt: start.toISOString(),
        endsAt: new Date(start.getTime() + 30 * 60_000).toISOString(),
        checklist: [],
        attendees: [],
        source: 'todo',
        linkHref: '/todos',
      };
    });
  const allEvents = [...events, ...googleEvents, ...todoEvents];

  return (
    <KalenderClient
      events={allEvents}
      density={density}
      yearDensity={yearDensity}
      conflicts={conflicts}
      alerts={alerts}
      resourceRows={resourceRows}
      templates={templates}
      customers={customers}
      vehicles={vehicles.map((v) => ({
        id: v.id,
        plate: v.plate,
        model: v.model,
        externalId: v.externalId ?? v.id,
      }))}
      contracts={contracts.map((c) => ({ id: c.id, title: c.title }))}
      counts={counts}
      members={members}
      currentUserId={user.id}
      standstills={standstills}
      workspaceId={ws.id}
    />
  );
}
