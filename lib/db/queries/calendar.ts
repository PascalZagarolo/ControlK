import 'server-only';
import { and, asc, eq, gt, gte, isNotNull, lte, ne, or, sql } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';
import type {
  CalendarConflict,
  CalendarEvent,
  CalendarPreFlightAlert,
  CalendarTemplate,
  DayDensityCell,
  CalendarEventKind,
} from '@/lib/types';

const DAY_MS = 86_400_000;

function toEvent(row: any): CalendarEvent {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    detail: row.detail ?? undefined,
    location: row.location ?? undefined,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    linkedCustomerId: row.linkedCustomerId ?? undefined,
    linkedCustomerName: row.customer?.name,
    linkedCustomerInitials: row.customer?.initials,
    linkedCustomerFrom: row.customer?.fromColor,
    linkedCustomerTo: row.customer?.toColor,
    linkedContractId: row.linkedContractId ?? undefined,
    linkedContractTitle: row.contract?.title,
    linkedVehicleId: row.linkedVehicleId ?? undefined,
    linkedVehicleExternalId: row.vehicle?.externalId ?? row.vehicle?.id,
    linkedVehiclePlate: row.vehicle?.plate,
    linkedVehicleModel: row.vehicle?.model,
    checklist: Array.isArray(row.checklist) ? row.checklist : [],
    recurringGroupId: row.recurringGroupId ?? undefined,
    recurringRule: row.recurringRule ?? undefined,
    reminderMinutes: row.reminderMinutes ?? undefined,
    completedAt: row.completedAt?.toISOString(),
    autoSpawnSource: row.autoSpawnSource ?? undefined,
    createdBy: row.createdBy
      ? {
          id: row.createdBy.id,
          name: row.createdBy.name,
          initials: row.createdBy.initials,
          from: row.createdBy.avatarFrom,
          to: row.createdBy.avatarTo,
        }
      : undefined,
  };
}

const RELATIONS = {
  customer: { columns: { id: true, name: true, initials: true, fromColor: true, toColor: true } },
  contract: { columns: { id: true, title: true } },
  vehicle: { columns: { id: true, externalId: true, plate: true, model: true } },
  createdBy: true,
} as const;

export async function listCalendarEvents(
  workspaceId: string,
  from: Date,
  to: Date
): Promise<CalendarEvent[]> {
  const db = getDb();
  const rows = await db.query.calendarEvents.findMany({
    where: and(
      eq(s.calendarEvents.workspaceId, workspaceId),
      gte(s.calendarEvents.endsAt, from),
      lte(s.calendarEvents.startsAt, to)
    ),
    orderBy: [asc(s.calendarEvents.startsAt)],
    with: RELATIONS as any,
  });
  return rows.map(toEvent);
}

export async function getCalendarEvent(
  workspaceId: string,
  eventId: string
): Promise<CalendarEvent | null> {
  const db = getDb();
  const row = await db.query.calendarEvents.findFirst({
    where: and(eq(s.calendarEvents.workspaceId, workspaceId), eq(s.calendarEvents.id, eventId)),
    with: RELATIONS as any,
  });
  return row ? toEvent(row) : null;
}

// ─── Day density (mini-cal heatmap) ──────────────────────────
export async function getDayDensity(
  workspaceId: string,
  from: Date,
  to: Date
): Promise<DayDensityCell[]> {
  const db = getDb();
  const rows = await db.execute<{ day: string; kind: CalendarEventKind; n: number | string }>(
    sql`
      SELECT DATE_TRUNC('day', ${s.calendarEvents.startsAt})::text AS day,
             ${s.calendarEvents.kind} AS kind,
             COUNT(*) AS n
      FROM ${s.calendarEvents}
      WHERE ${s.calendarEvents.workspaceId} = ${workspaceId}
        AND ${s.calendarEvents.startsAt} >= ${from}
        AND ${s.calendarEvents.startsAt} <= ${to}
      GROUP BY day, kind
    `
  );
  const list: any[] = Array.isArray((rows as any).rows) ? (rows as any).rows : (rows as any);
  const byDay = new Map<string, DayDensityCell>();
  for (const r of list) {
    const iso = new Date(r.day).toISOString().slice(0, 10);
    let cell = byDay.get(iso);
    if (!cell) {
      cell = {
        dateIso: iso,
        count: 0,
        kinds: {
          meeting: 0,
          call: 0,
          focus: 0,
          task: 0,
          personal: 0,
          health: 0,
          travel: 0,
          other: 0,
          handover: 0,
          return: 0,
          maintenance: 0,
          internal: 0,
        },
      };
      byDay.set(iso, cell);
    }
    const n = Number(r.n);
    cell.count += n;
    cell.kinds[r.kind as CalendarEventKind] = n;
  }
  return Array.from(byDay.values());
}

// ─── Vehicle conflicts (overlapping bookings per vehicle) ────
export async function getCalendarConflicts(
  workspaceId: string,
  from: Date,
  to: Date
): Promise<CalendarConflict[]> {
  const db = getDb();
  const events = await db.query.calendarEvents.findMany({
    where: and(
      eq(s.calendarEvents.workspaceId, workspaceId),
      isNotNull(s.calendarEvents.linkedVehicleId),
      gte(s.calendarEvents.endsAt, from),
      lte(s.calendarEvents.startsAt, to)
    ),
    with: { vehicle: { columns: { id: true, plate: true } } },
  });
  // Group by vehicle, find overlapping pairs
  const byVehicle = new Map<string, any[]>();
  for (const e of events) {
    if (!e.linkedVehicleId) continue;
    if (!byVehicle.has(e.linkedVehicleId)) byVehicle.set(e.linkedVehicleId, []);
    byVehicle.get(e.linkedVehicleId)!.push(e);
  }
  const out: CalendarConflict[] = [];
  for (const [vehicleId, evts] of byVehicle) {
    evts.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    const conflicting = new Set<any>();
    for (let i = 0; i < evts.length; i++) {
      for (let j = i + 1; j < evts.length; j++) {
        if (evts[j].startsAt >= evts[i].endsAt) break;
        conflicting.add(evts[i]);
        conflicting.add(evts[j]);
      }
    }
    if (conflicting.size > 0) {
      const first = evts[0];
      out.push({
        vehicleId,
        vehiclePlate: (first.vehicle as any)?.plate ?? '?',
        events: Array.from(conflicting).map((e: any) => ({
          id: e.id,
          title: e.title,
          startsAt: e.startsAt.toISOString(),
          endsAt: e.endsAt.toISOString(),
        })),
      });
    }
  }
  return out;
}

// ─── Detect conflict for a candidate new event ───────────────
export async function detectConflictForCandidate(
  workspaceId: string,
  vehicleId: string,
  startsAt: Date,
  endsAt: Date,
  excludeEventId?: string
): Promise<{ id: string; title: string; startsAt: string; endsAt: string }[]> {
  const db = getDb();
  const where: any[] = [
    eq(s.calendarEvents.workspaceId, workspaceId),
    eq(s.calendarEvents.linkedVehicleId, vehicleId),
    // overlap: existing.endsAt > candidate.startsAt AND existing.startsAt < candidate.endsAt
    gt(s.calendarEvents.endsAt, startsAt),
    sql`${s.calendarEvents.startsAt} < ${endsAt}`,
  ];
  if (excludeEventId) where.push(ne(s.calendarEvents.id, excludeEventId));
  const rows = await db.query.calendarEvents.findMany({
    where: and(...where),
    columns: { id: true, title: true, startsAt: true, endsAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt.toISOString(),
  }));
}

// ─── Pre-Flight alerts ──────────────────────────────────────
export async function getPreFlightAlerts(
  workspaceId: string
): Promise<CalendarPreFlightAlert[]> {
  const db = getDb();
  const now = new Date();
  const horizon = new Date(now.getTime() + 6 * 60 * 60 * 1000); // next 6h
  const events = await db.query.calendarEvents.findMany({
    where: and(
      eq(s.calendarEvents.workspaceId, workspaceId),
      gte(s.calendarEvents.startsAt, now),
      lte(s.calendarEvents.startsAt, horizon)
    ),
    with: { vehicle: { columns: { id: true, plate: true, status: true } } },
    orderBy: [asc(s.calendarEvents.startsAt)],
  });
  const alerts: CalendarPreFlightAlert[] = [];
  for (const e of events) {
    const minutesUntil = Math.round((e.startsAt.getTime() - now.getTime()) / 60_000);
    const checklist = Array.isArray(e.checklist) ? e.checklist : [];
    if (
      e.kind !== 'internal' &&
      checklist.length > 0 &&
      checklist.some((c: any) => !c.done) &&
      minutesUntil <= 120
    ) {
      const remaining = checklist.filter((c: any) => !c.done).length;
      alerts.push({
        eventId: e.id,
        title: e.title,
        startsAt: e.startsAt.toISOString(),
        minutesUntil,
        reason: 'checklist_incomplete',
        detail: `${remaining} Schritt${remaining === 1 ? '' : 'e'} offen`,
      });
    }
    if (
      e.kind === 'handover' &&
      (e.vehicle as any)?.status === 'vermietet' &&
      minutesUntil <= 180
    ) {
      alerts.push({
        eventId: e.id,
        title: e.title,
        startsAt: e.startsAt.toISOString(),
        minutesUntil,
        reason: 'vehicle_still_rented',
        detail: `Fahrzeug ${(e.vehicle as any).plate} ist noch vermietet`,
      });
    }
  }
  return alerts;
}

// ─── Resource-view rows ─────────────────────────────────────
export async function getResourceRows(
  workspaceId: string,
  from: Date,
  to: Date
): Promise<{
  vehicleId: string;
  externalId: string;
  plate: string;
  model: string;
  status: string;
  events: { id: string; kind: string; title: string; startsAt: string; endsAt: string; customerName?: string }[];
}[]> {
  const db = getDb();
  const vehicles = await db.query.vehicles.findMany({
    where: eq(s.vehicles.workspaceId, workspaceId),
    orderBy: [asc(s.vehicles.plate)],
    columns: { id: true, externalId: true, plate: true, model: true, status: true },
  });
  if (vehicles.length === 0) return [];
  const events = await db.query.calendarEvents.findMany({
    where: and(
      eq(s.calendarEvents.workspaceId, workspaceId),
      isNotNull(s.calendarEvents.linkedVehicleId),
      gte(s.calendarEvents.endsAt, from),
      lte(s.calendarEvents.startsAt, to)
    ),
    with: { customer: { columns: { name: true } } },
    orderBy: [asc(s.calendarEvents.startsAt)],
  });
  const byVehicle = new Map<string, any[]>();
  for (const e of events) {
    if (!e.linkedVehicleId) continue;
    if (!byVehicle.has(e.linkedVehicleId)) byVehicle.set(e.linkedVehicleId, []);
    byVehicle.get(e.linkedVehicleId)!.push(e);
  }
  return vehicles.map((v) => ({
    vehicleId: v.id,
    externalId: v.externalId ?? v.id,
    plate: v.plate,
    model: v.model,
    status: v.status,
    events: (byVehicle.get(v.id) ?? []).map((e: any) => ({
      id: e.id,
      kind: e.kind,
      title: e.title,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt.toISOString(),
      customerName: e.customer?.name,
    })),
  }));
}

// ─── Year heatmap (365-day grid) ────────────────────────────
export async function getYearHeatmap(workspaceId: string): Promise<DayDensityCell[]> {
  const now = new Date();
  const start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  return getDayDensity(workspaceId, start, now);
}

// ─── Templates ──────────────────────────────────────────────
export async function listCalendarTemplates(
  workspaceId: string
): Promise<CalendarTemplate[]> {
  const db = getDb();
  const rows = await db.query.calendarEventTemplates.findMany({
    where: eq(s.calendarEventTemplates.workspaceId, workspaceId),
    orderBy: [asc(s.calendarEventTemplates.name)],
  });
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    kind: r.kind,
    defaultDurationMinutes: r.defaultDurationMinutes,
    defaultChecklist: r.defaultChecklist ?? [],
    description: r.description ?? undefined,
  }));
}

// ─── Smart counts for sidebar ───────────────────────────────
export async function smartCalendarCounts(workspaceId: string) {
  const db = getDb();
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endToday = new Date(startToday.getTime() + DAY_MS);
  const endWeek = new Date(startToday.getTime() + 7 * DAY_MS);

  const [today, week, conflicts, withChecklist] = await Promise.all([
    db
      .select({ n: sql<number>`COUNT(*)` })
      .from(s.calendarEvents)
      .where(
        and(
          eq(s.calendarEvents.workspaceId, workspaceId),
          gte(s.calendarEvents.startsAt, startToday),
          lte(s.calendarEvents.startsAt, endToday)
        )
      ),
    db
      .select({ n: sql<number>`COUNT(*)` })
      .from(s.calendarEvents)
      .where(
        and(
          eq(s.calendarEvents.workspaceId, workspaceId),
          gte(s.calendarEvents.startsAt, startToday),
          lte(s.calendarEvents.startsAt, endWeek)
        )
      ),
    getCalendarConflicts(workspaceId, startToday, endWeek),
    db
      .select({ n: sql<number>`COUNT(*)` })
      .from(s.calendarEvents)
      .where(
        and(
          eq(s.calendarEvents.workspaceId, workspaceId),
          gte(s.calendarEvents.startsAt, startToday),
          sql`jsonb_array_length(${s.calendarEvents.checklist}) > 0`,
          sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${s.calendarEvents.checklist}) elem WHERE (elem->>'done')::boolean = false)`
        )
      ),
  ]);
  return {
    today: Number(today[0]?.n ?? 0),
    thisWeek: Number(week[0]?.n ?? 0),
    conflicts: conflicts.length,
    openChecklists: Number(withChecklist[0]?.n ?? 0),
  };
}
