import 'server-only';
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, lt, lte, sql } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';
import type {
  ServiceForecast,
  Vehicle,
  VehicleBookingConflict,
  VehicleDamageEntry,
  VehicleDamageStats,
  VehicleHealth,
  VehicleIncome,
  VehicleMaintenanceEntry,
  VehiclePricing,
  VehicleTag,
  VehicleUtilization,
  TodoUser,
  Booking,
} from '@/lib/types';

const DAY_MS = 86_400_000;

function toUser(row: any): TodoUser | undefined {
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    initials: row.initials,
    from: row.avatarFrom,
    to: row.avatarTo,
  };
}

function toTag(row: any): VehicleTag {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    color: row.color ?? undefined,
  };
}

// ─── Utilization ─────────────────────────────────────────────
export async function getUtilization(
  vehicleId: string
): Promise<VehicleUtilization> {
  const db = getDb();
  const now = new Date();
  const since90 = new Date(now.getTime() - 89 * DAY_MS);
  since90.setHours(0, 0, 0, 0);
  const since30 = new Date(now.getTime() - 30 * DAY_MS);
  since30.setHours(0, 0, 0, 0);

  const events = await db.query.calendarEvents.findMany({
    where: and(
      eq(s.calendarEvents.linkedVehicleId, vehicleId),
      sql`${s.calendarEvents.endsAt} >= ${since90}`
    ),
    columns: { kind: true, startsAt: true, endsAt: true },
  });

  // Build day buckets (90 days)
  const daily: ('frei' | 'vermietet' | 'wartung' | 'reserviert')[] = Array.from(
    { length: 90 },
    () => 'frei'
  );
  const indexFor = (d: Date) => {
    const t = new Date(d);
    t.setHours(0, 0, 0, 0);
    const idx = Math.floor((t.getTime() - since90.getTime()) / DAY_MS);
    return Math.max(0, Math.min(89, idx));
  };
  const kindToStatus = (k: string): typeof daily[number] => {
    if (k === 'handover' || k === 'return') return 'vermietet';
    if (k === 'maintenance') return 'wartung';
    return 'reserviert';
  };

  for (const e of events) {
    const start = e.startsAt < since90 ? since90 : e.startsAt;
    const end = e.endsAt > now ? now : e.endsAt;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const idx = indexFor(d);
      const next = kindToStatus(e.kind);
      // Priority: wartung > vermietet > reserviert > frei
      if (next === 'wartung') daily[idx] = 'wartung';
      else if (next === 'vermietet' && daily[idx] === 'frei')
        daily[idx] = 'vermietet';
      else if (next === 'reserviert' && daily[idx] === 'frei')
        daily[idx] = 'reserviert';
    }
  }

  const busy30 = daily.slice(60).filter((d) => d === 'vermietet').length;
  const busy90 = daily.filter((d) => d === 'vermietet').length;

  // 7-day spark: 7 days going back from today
  const spark = daily.slice(-7).map((d) => (d === 'vermietet' ? 1 : 0));

  return {
    pct90d: busy90 / 90,
    pct30d: busy30 / 30,
    spark,
    daily,
  };
}

// ─── Income ──────────────────────────────────────────────────
export async function getVehicleIncome(
  workspaceId: string,
  vehicleId: string,
  fixedMonthlyCents: number
): Promise<VehicleIncome> {
  const db = getDb();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  // Income via calendar events × contracts.valueCents (proportional to days of overlap)
  const events = await db
    .select({
      startsAt: s.calendarEvents.startsAt,
      endsAt: s.calendarEvents.endsAt,
      valueCents: s.contracts.valueCents,
      contractStart: s.contracts.startsAt,
      contractEnd: s.contracts.endsAt,
    })
    .from(s.calendarEvents)
    .innerJoin(s.contracts, eq(s.calendarEvents.linkedContractId, s.contracts.id))
    .where(
      and(
        eq(s.calendarEvents.workspaceId, workspaceId),
        eq(s.calendarEvents.linkedVehicleId, vehicleId),
        gte(s.calendarEvents.endsAt, start)
      )
    );

  const buckets: { label: string; cents: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ label: m.toLocaleString('de-DE', { month: 'short' }), cents: 0 });
  }

  let totalCents = 0;
  let totalDays = 0;
  for (const e of events) {
    const contractDays = Math.max(
      1,
      Math.ceil(
        ((e.contractEnd ?? e.endsAt).getTime() - (e.contractStart ?? e.startsAt).getTime()) / DAY_MS
      )
    );
    const perDayCents = Math.round((e.valueCents ?? 0) / contractDays);
    const eventDays = Math.max(
      1,
      Math.ceil((e.endsAt.getTime() - e.startsAt.getTime()) / DAY_MS)
    );
    const cents = perDayCents * eventDays;
    totalCents += cents;
    totalDays += eventDays;
    const monthIdx = (e.startsAt.getFullYear() - start.getFullYear()) * 12 +
      (e.startsAt.getMonth() - start.getMonth());
    if (monthIdx >= 0 && monthIdx < 12) buckets[monthIdx].cents += cents;
  }

  const perDayCents = totalDays > 0 ? Math.round(totalCents / totalDays) : 0;
  const monthlyAverageCents = Math.round(totalCents / 12);
  const netMarginCents = totalCents - fixedMonthlyCents * 12;
  return {
    totalCents,
    monthlyAverageCents,
    perDayCents,
    buckets,
    netMarginCents,
  };
}

// ─── Damages ─────────────────────────────────────────────────
export async function getVehicleDamages(
  vehicleId: string
): Promise<VehicleDamageEntry[]> {
  const db = getDb();
  const rows = await db.query.vehicleDamages.findMany({
    where: eq(s.vehicleDamages.vehicleId, vehicleId),
    orderBy: [desc(s.vehicleDamages.occurredAt)],
    with: {
      customer: { columns: { id: true, name: true } },
      contract: { columns: { id: true, title: true } },
    },
  });
  return rows.map((r: any) => ({
    id: r.id,
    date: r.occurredAt.toISOString(),
    severity: r.severity,
    title: r.title,
    description: r.description ?? undefined,
    photoUrl: r.photoUrl ?? undefined,
    costCents: r.costCents ?? undefined,
    customerId: r.customer?.id,
    customerName: r.customer?.name,
    contractId: r.contract?.id,
    contractTitle: r.contract?.title,
    resolved: r.resolved === 1,
  }));
}

export async function getDamageStats(
  workspaceId: string,
  vehicleId: string,
  vehicleAgeYears: number
): Promise<VehicleDamageStats> {
  const db = getDb();
  // This vehicle
  const own = await db
    .select({
      total: sql<number>`COUNT(*)`,
      cost: sql<number>`COALESCE(SUM(${s.vehicleDamages.costCents}),0)`,
    })
    .from(s.vehicleDamages)
    .where(eq(s.vehicleDamages.vehicleId, vehicleId));
  const totalDamages = Number(own[0]?.total ?? 0);
  const totalCostCents = Number(own[0]?.cost ?? 0);
  const yearsCovered = Math.max(1, vehicleAgeYears);
  const ratePerYear = totalDamages / yearsCovered;

  // Fleet average
  const fleet = await db
    .select({
      total: sql<number>`COUNT(*)`,
      vehicles: sql<number>`COUNT(DISTINCT ${s.vehicleDamages.vehicleId})`,
    })
    .from(s.vehicleDamages)
    .where(eq(s.vehicleDamages.workspaceId, workspaceId));
  const fleetTotal = Number(fleet[0]?.total ?? 0);
  const fleetVehicles = Math.max(1, Number(fleet[0]?.vehicles ?? 1));
  const fleetAvgRate = fleetTotal / fleetVehicles / yearsCovered;
  const deltaPercent =
    fleetAvgRate > 0 ? Math.round(((ratePerYear - fleetAvgRate) / fleetAvgRate) * 100) : 0;

  // Top offenders
  const offenderRows = await db
    .select({
      customerName: s.customers.name,
      count: sql<number>`COUNT(*)`,
    })
    .from(s.vehicleDamages)
    .innerJoin(s.customers, eq(s.vehicleDamages.customerId, s.customers.id))
    .where(eq(s.vehicleDamages.vehicleId, vehicleId))
    .groupBy(s.customers.name)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(3);
  const topOffenders = offenderRows.map((o) => ({
    customerName: o.customerName,
    count: Number(o.count),
  }));

  return { totalDamages, totalCostCents, ratePerYear, fleetAvgRate, deltaPercent, topOffenders };
}

// ─── Maintenance ─────────────────────────────────────────────
export async function getMaintenance(
  vehicleId: string,
  currentKm: number
): Promise<VehicleMaintenanceEntry[]> {
  const db = getDb();
  const rows = await db.query.vehicleMaintenance.findMany({
    where: eq(s.vehicleMaintenance.vehicleId, vehicleId),
    orderBy: [asc(s.vehicleMaintenance.nextDueAt)],
  });
  const now = Date.now();
  return rows.map((r) => {
    const overdue =
      (r.nextDueAt && r.nextDueAt.getTime() < now) ||
      (r.intervalKm && r.lastDoneKm != null && currentKm - r.lastDoneKm >= r.intervalKm);
    return {
      id: r.id,
      kind: r.kind,
      title: r.title,
      intervalKm: r.intervalKm ?? undefined,
      intervalDays: r.intervalDays ?? undefined,
      lastDoneKm: r.lastDoneKm ?? undefined,
      lastDoneAt: r.lastDoneAt?.toISOString(),
      nextDueAt: r.nextDueAt?.toISOString(),
      overdue: !!overdue,
    };
  });
}

// ─── Bookings (Booking[] for backward compat) ────────────────
export async function getBookings(vehicleId: string): Promise<Booking[]> {
  const db = getDb();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 30 * DAY_MS);

  const events = await db
    .select({
      startsAt: s.calendarEvents.startsAt,
      endsAt: s.calendarEvents.endsAt,
      kind: s.calendarEvents.kind,
      customerName: s.customers.name,
    })
    .from(s.calendarEvents)
    .leftJoin(s.customers, eq(s.calendarEvents.linkedCustomerId, s.customers.id))
    .where(
      and(
        eq(s.calendarEvents.linkedVehicleId, vehicleId),
        lt(s.calendarEvents.startsAt, end),
        gt(s.calendarEvents.endsAt, start)
      )
    );

  const out: Booking[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(start.getTime() + i * DAY_MS);
    const next = new Date(d.getTime() + DAY_MS);
    let status: Booking['status'] = 'frei';
    let label: string | undefined;
    for (const e of events) {
      if (e.endsAt <= d || e.startsAt >= next) continue;
      if (e.kind === 'maintenance') {
        status = 'wartung';
        label = 'Wartung';
        break;
      }
      if (e.kind === 'handover' || e.kind === 'return') {
        status = 'vermietet';
        label = e.customerName ?? undefined;
        break;
      }
      if (status === 'frei') {
        status = 'reserviert';
        label = 'Reserviert';
      }
    }
    out.push({ date: d.toISOString().slice(0, 10), status, label });
  }
  return out;
}

// ─── Frequent Renters ────────────────────────────────────────
export async function getFrequentRenters(
  vehicleId: string
): Promise<{ customerId?: string; customerName: string; bookings: number }[]> {
  const db = getDb();
  const rows = await db
    .select({
      customerId: s.customers.id,
      customerName: s.customers.name,
      count: sql<number>`COUNT(*)`,
    })
    .from(s.calendarEvents)
    .innerJoin(s.customers, eq(s.calendarEvents.linkedCustomerId, s.customers.id))
    .where(eq(s.calendarEvents.linkedVehicleId, vehicleId))
    .groupBy(s.customers.id, s.customers.name)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(5);
  return rows.map((r) => ({
    customerId: r.customerId,
    customerName: r.customerName,
    bookings: Number(r.count),
  }));
}

// ─── Conflicts ───────────────────────────────────────────────
export async function getConflicts(
  workspaceId: string,
  vehicleId: string
): Promise<VehicleBookingConflict[]> {
  const db = getDb();
  // Two calendar events on same vehicle with overlapping time
  const events = await db
    .select({
      id: s.calendarEvents.id,
      startsAt: s.calendarEvents.startsAt,
      endsAt: s.calendarEvents.endsAt,
      contractId: s.calendarEvents.linkedContractId,
      contractTitle: s.contracts.title,
      customerName: s.customers.name,
    })
    .from(s.calendarEvents)
    .leftJoin(s.contracts, eq(s.calendarEvents.linkedContractId, s.contracts.id))
    .leftJoin(s.customers, eq(s.calendarEvents.linkedCustomerId, s.customers.id))
    .where(
      and(
        eq(s.calendarEvents.workspaceId, workspaceId),
        eq(s.calendarEvents.linkedVehicleId, vehicleId)
      )
    );
  const conflicts: VehicleBookingConflict[] = [];
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];
      if (a.endsAt > b.startsAt && b.endsAt > a.startsAt) {
        conflicts.push({
          date: a.startsAt > b.startsAt ? a.startsAt.toISOString() : b.startsAt.toISOString(),
          bookingA: {
            contractId: a.contractId ?? undefined,
            contractTitle: a.contractTitle ?? undefined,
            customerName: a.customerName ?? undefined,
          },
          bookingB: {
            contractId: b.contractId ?? undefined,
            contractTitle: b.contractTitle ?? undefined,
            customerName: b.customerName ?? undefined,
          },
        });
      }
    }
  }
  return conflicts;
}

// ─── Health ──────────────────────────────────────────────────
export function computeVehicleHealth(input: {
  ageYears: number;
  km: number;
  damageRate: number;
  daysSinceInspection: number;
  ratingTenths: number;
  utilizationPct: number;
}): VehicleHealth {
  // Age (20): newer is better
  const age = Math.max(0, 20 - Math.min(20, input.ageYears * 2.5));
  // KM (20): inverse, 200k km = 0 points
  const km = Math.max(0, 20 - (input.km / 10_000));
  // Damages (25): more = worse
  const damages = Math.max(0, 25 - Math.min(25, input.damageRate * 8));
  // Inspection (15): older = worse, ideal ≤365d
  let inspection = 15;
  if (input.daysSinceInspection > 730) inspection = 0;
  else if (input.daysSinceInspection > 365) inspection = 5;
  else if (input.daysSinceInspection > 180) inspection = 10;
  // Rating (10): 50 (5.0) = full points
  const rating = Math.min(10, (input.ratingTenths / 50) * 10);
  // Utilization (10): sweet spot 60-85%
  let utilization = 0;
  if (input.utilizationPct >= 0.6 && input.utilizationPct <= 0.85) utilization = 10;
  else if (input.utilizationPct >= 0.4) utilization = 7;
  else if (input.utilizationPct >= 0.2) utilization = 4;
  else utilization = 1;

  const score = Math.round(age + km + damages + inspection + rating + utilization);
  return {
    score: Math.min(100, score),
    components: {
      age: Math.round(age),
      km: Math.round(km),
      damages: Math.round(damages),
      inspection: Math.round(inspection),
      rating: Math.round(rating),
      utilization: Math.round(utilization),
    },
    spark: [], // filled by enricher
  };
}

// ─── Service Forecast ────────────────────────────────────────
export function computeServiceForecast(input: {
  intervalKm?: number;
  intervalDays?: number;
  lastServiceKm?: number;
  lastServiceAt?: Date;
  currentKm: number;
  monthlyKm: number;
}): ServiceForecast {
  const dueByKm =
    input.intervalKm && input.lastServiceKm != null
      ? input.lastServiceKm + input.intervalKm
      : undefined;
  const dueByDate =
    input.intervalDays && input.lastServiceAt
      ? new Date(input.lastServiceAt.getTime() + input.intervalDays * DAY_MS)
      : undefined;
  const now = new Date();
  const daysToNext = dueByDate
    ? Math.ceil((dueByDate.getTime() - now.getTime()) / DAY_MS)
    : undefined;
  const kmToNext = dueByKm ? dueByKm - input.currentKm : undefined;
  // Also: project days till km-due based on monthlyKm
  let projectedDaysToKm: number | undefined;
  if (kmToNext != null && input.monthlyKm > 0) {
    projectedDaysToKm = Math.floor((kmToNext / input.monthlyKm) * 30);
  }
  const effectiveDays =
    daysToNext != null && projectedDaysToKm != null
      ? Math.min(daysToNext, projectedDaysToKm)
      : daysToNext ?? projectedDaysToKm;

  let status: ServiceForecast['status'] = 'fine';
  let reason: string | undefined;
  if ((kmToNext != null && kmToNext < 0) || (daysToNext != null && daysToNext < 0)) {
    status = 'overdue';
    reason =
      kmToNext != null && kmToNext < 0
        ? `Service ${Math.abs(kmToNext)} km überfällig`
        : 'Service-Datum überschritten';
  } else if (effectiveDays != null && effectiveDays <= 30) {
    status = 'soon';
    reason = `Service in ~${effectiveDays}d fällig`;
  }
  return {
    daysToNext: effectiveDays,
    kmToNext,
    status,
    reason,
  };
}

// ─── Full enriched vehicle ───────────────────────────────────
export async function getVehicleFullByExternalId(
  workspaceId: string,
  externalId: string
): Promise<Vehicle | null> {
  const db = getDb();
  const row: any = await db.query.vehicles.findFirst({
    where: and(
      eq(s.vehicles.workspaceId, workspaceId),
      eq(s.vehicles.externalId, externalId)
    ),
    with: {
      owner: true,
      tagAssignments: { with: { tag: true } },
    },
  });
  if (!row) return null;

  const ageYears = (Date.now() - row.createdAt.getTime()) / (365 * DAY_MS);

  const [util, damages, damageStats, maintenance, bookings, frequentRenters, conflicts] =
    await Promise.all([
      getUtilization(row.id),
      getVehicleDamages(row.id),
      getDamageStats(workspaceId, row.id, ageYears),
      getMaintenance(row.id, row.km ?? 0),
      getBookings(row.id),
      getFrequentRenters(row.id),
      getConflicts(workspaceId, row.id),
    ]);

  const income = await getVehicleIncome(workspaceId, row.id, row.monthlyFixedCostsCents ?? 0);

  // Inspection days
  const daysSinceInspection = row.lastInspection
    ? (() => {
        const d = new Date(row.lastInspection);
        if (Number.isNaN(d.getTime())) return 0;
        return Math.floor((Date.now() - d.getTime()) / DAY_MS);
      })()
    : 9999;

  const health = computeVehicleHealth({
    ageYears,
    km: row.km ?? 0,
    damageRate: damageStats.ratePerYear,
    daysSinceInspection,
    ratingTenths: row.ratingTenths ?? 0,
    utilizationPct: util.pct90d,
  });
  health.spark = util.spark;

  // Service forecast — estimate monthly km from ageYears + km
  const monthlyKm = ageYears > 0 ? (row.km ?? 0) / (ageYears * 12) : 0;
  const serviceForecast = computeServiceForecast({
    intervalKm: row.serviceIntervalKm ?? undefined,
    intervalDays: row.serviceIntervalDays ?? undefined,
    lastServiceKm: row.lastServiceKm ?? undefined,
    lastServiceAt: row.lastServiceAt ?? undefined,
    currentKm: row.km ?? 0,
    monthlyKm,
  });

  return {
    id: row.externalId ?? row.id,
    dbId: row.id,
    plate: row.plate,
    model: row.model,
    kind: row.kind,
    status: row.status,
    location: row.location ?? '',
    km: row.km ?? 0,
    nextService: row.nextService ?? '—',
    lastInspection: row.lastInspection ?? '—',
    rating: row.ratingTenths ? row.ratingTenths / 10 : 0,
    damageHistory: damages,
    frequentRenters,
    upcomingMaintenance: maintenance,
    bookings,
    owner: toUser(row.owner),
    tags: (row.tagAssignments ?? []).map((ta: any) => toTag(ta.tag)),
    utilization: util,
    income,
    health,
    conflicts,
    damagePattern: damageStats,
    pricing: {
      dailyRateCents: row.dailyRateCents ?? undefined,
      weekendSurchargeCents: row.weekendSurchargeCents ?? undefined,
      acquisitionCents: row.acquisitionCents ?? undefined,
      monthlyFixedCostsCents: row.monthlyFixedCostsCents ?? undefined,
    },
    notes: row.notes ?? '',
    serviceForecast,
  };
}
