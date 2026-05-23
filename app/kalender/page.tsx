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
  ]);

  return (
    <KalenderClient
      events={events}
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
    />
  );
}
