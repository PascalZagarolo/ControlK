import 'server-only';
import { and, asc, count, desc, eq, gt, sql } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';
import {
  computeServiceForecast,
  computeVehicleHealth,
  getUtilization,
  getVehicleIncome,
} from './vehicle-detail';
import type { Vehicle, VehicleTag } from '@/lib/types';

const DAY_MS = 86_400_000;

function toUser(row: any) {
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    initials: row.initials,
    from: row.avatarFrom,
    to: row.avatarTo,
  };
}

export async function listVehicles(workspaceId: string): Promise<Vehicle[]> {
  const db = getDb();
  const rows = await db.query.vehicles.findMany({
    where: eq(s.vehicles.workspaceId, workspaceId),
    orderBy: [asc(s.vehicles.plate)],
    with: {
      owner: true,
      tagAssignments: { with: { tag: true } },
    },
  });
  return rows.map(toBaseVehicle);
}

/**
 * Detailed list: includes per-vehicle utilization, income, health.
 * Heavier — use only on the list page.
 */
export async function listVehiclesDetailed(workspaceId: string): Promise<Vehicle[]> {
  const db = getDb();
  const rows = await db.query.vehicles.findMany({
    where: eq(s.vehicles.workspaceId, workspaceId),
    orderBy: [asc(s.vehicles.plate)],
    with: {
      owner: true,
      tagAssignments: { with: { tag: true } },
    },
  });

  // Batch damage counts per vehicle
  const damageRows = await db
    .select({
      vehicleId: s.vehicleDamages.vehicleId,
      count: sql<number>`COUNT(*)`,
    })
    .from(s.vehicleDamages)
    .where(eq(s.vehicleDamages.workspaceId, workspaceId))
    .groupBy(s.vehicleDamages.vehicleId);
  const damageByVehicle = new Map<string, number>();
  for (const d of damageRows) damageByVehicle.set(d.vehicleId, Number(d.count));

  const out: Vehicle[] = [];
  for (const row of rows) {
    const base = toBaseVehicle(row);
    const ageYears = (Date.now() - row.createdAt.getTime()) / (365 * DAY_MS);
    const damageCount = damageByVehicle.get(row.id) ?? 0;
    const damageRate = damageCount / Math.max(1, ageYears);

    const utilization = await getUtilization(row.id);
    const income = await getVehicleIncome(
      workspaceId,
      row.id,
      row.monthlyFixedCostsCents ?? 0
    );

    const daysSinceInspection = row.lastInspection
      ? (() => {
          const d = new Date(row.lastInspection);
          if (Number.isNaN(d.getTime())) return 9999;
          return Math.floor((Date.now() - d.getTime()) / DAY_MS);
        })()
      : 9999;

    const health = computeVehicleHealth({
      ageYears,
      km: row.km ?? 0,
      damageRate,
      daysSinceInspection,
      ratingTenths: row.ratingTenths ?? 0,
      utilizationPct: utilization.pct90d,
    });
    health.spark = utilization.spark;

    const monthlyKm = ageYears > 0 ? (row.km ?? 0) / (ageYears * 12) : 0;
    const serviceForecast = computeServiceForecast({
      intervalKm: row.serviceIntervalKm ?? undefined,
      intervalDays: row.serviceIntervalDays ?? undefined,
      lastServiceKm: row.lastServiceKm ?? undefined,
      lastServiceAt: row.lastServiceAt ?? undefined,
      currentKm: row.km ?? 0,
      monthlyKm,
    });

    out.push({
      ...base,
      utilization,
      income,
      health,
      serviceForecast,
      pricing: {
        dailyRateCents: row.dailyRateCents ?? undefined,
        weekendSurchargeCents: row.weekendSurchargeCents ?? undefined,
        acquisitionCents: row.acquisitionCents ?? undefined,
        monthlyFixedCostsCents: row.monthlyFixedCostsCents ?? undefined,
      },
    });
  }
  return out;
}

export async function getVehicle(
  workspaceId: string,
  externalId: string
): Promise<Vehicle | null> {
  const db = getDb();
  const row = await db.query.vehicles.findFirst({
    where: and(eq(s.vehicles.workspaceId, workspaceId), eq(s.vehicles.externalId, externalId)),
    with: {
      owner: true,
      tagAssignments: { with: { tag: true } },
    },
  });
  if (!row) return null;
  return toBaseVehicle(row);
}

function toBaseVehicle(row: any): Vehicle {
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
    damageHistory: [],
    frequentRenters: [],
    upcomingMaintenance: [],
    bookings: [],
    owner: toUser(row.owner),
    tags: (row.tagAssignments ?? []).map((ta: any) => ({
      id: ta.tag.id,
      slug: ta.tag.slug,
      name: ta.tag.name,
      color: ta.tag.color ?? undefined,
    })),
    notes: row.notes ?? '',
  };
}

export async function listVehicleTags(workspaceId: string): Promise<VehicleTag[]> {
  const db = getDb();
  const rows = await db.query.vehicleTags.findMany({
    where: eq(s.vehicleTags.workspaceId, workspaceId),
    orderBy: [asc(s.vehicleTags.name)],
  });
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    color: r.color ?? undefined,
  }));
}

export async function smartVehicleCounts(workspaceId: string, currentUserId?: string) {
  const db = getDb();
  const rows = await db.query.vehicles.findMany({
    where: eq(s.vehicles.workspaceId, workspaceId),
    columns: {
      id: true,
      status: true,
      ownerId: true,
      km: true,
      lastServiceKm: true,
      serviceIntervalKm: true,
      serviceIntervalDays: true,
      lastServiceAt: true,
    },
  });
  let frei = 0,
    vermietet = 0,
    wartung = 0,
    reserviert = 0,
    mine = 0,
    serviceDue = 0;
  const now = Date.now();
  for (const v of rows) {
    if (v.status === 'frei') frei += 1;
    if (v.status === 'vermietet') vermietet += 1;
    if (v.status === 'wartung') wartung += 1;
    if (v.status === 'reserviert') reserviert += 1;
    if (currentUserId && v.ownerId === currentUserId) mine += 1;
    const kmDue =
      v.serviceIntervalKm && v.lastServiceKm != null
        ? (v.km ?? 0) - v.lastServiceKm >= v.serviceIntervalKm * 0.9
        : false;
    const dayDue =
      v.serviceIntervalDays && v.lastServiceAt
        ? Date.now() - v.lastServiceAt.getTime() >= v.serviceIntervalDays * DAY_MS * 0.9
        : false;
    if (kmDue || dayDue) serviceDue += 1;
  }
  return {
    all: rows.length,
    frei,
    vermietet,
    wartung,
    reserviert,
    mine,
    serviceDue,
  };
}
