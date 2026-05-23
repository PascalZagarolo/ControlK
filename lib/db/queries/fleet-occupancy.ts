import 'server-only';
import { and, eq, gte, lte } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';

export type OccupancyDay = {
  date: string; // YYYY-MM-DD
  bookedCount: number;
  totalCount: number;
  utilization: number; // 0..1
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
  recommendedMarkupPct: number; // 0..30
};

const GERMAN_HOLIDAYS_2026: Record<string, string> = {
  '2026-01-01': 'Neujahr',
  '2026-04-03': 'Karfreitag',
  '2026-04-06': 'Ostermontag',
  '2026-05-01': 'Tag der Arbeit',
  '2026-05-14': 'Christi Himmelfahrt',
  '2026-05-25': 'Pfingstmontag',
  '2026-10-03': 'Tag der Deutschen Einheit',
  '2026-12-25': '1. Weihnachtstag',
  '2026-12-26': '2. Weihnachtstag',
};

function isHolidayDate(date: Date): { isHoliday: boolean; name?: string } {
  const key = date.toISOString().slice(0, 10);
  const name = GERMAN_HOLIDAYS_2026[key];
  return { isHoliday: !!name, name };
}

function daysAround(holidayDate: Date, otherDate: Date): number {
  return Math.abs(holidayDate.getTime() - otherDate.getTime()) / 86_400_000;
}

/**
 * Compute the recommended dynamic-price markup as a percentage (0..30).
 *
 * Heuristic:
 *   utilization 0.0..0.4   -> 0%   (plenty of stock, no pressure)
 *   utilization 0.4..0.6   -> 5%
 *   utilization 0.6..0.75  -> 10%
 *   utilization 0.75..0.85 -> 15%
 *   utilization 0.85+      -> 20%
 *   + 5%  if weekend
 *   + 10% if German holiday OR within 3 days of a holiday
 *   capped at 30
 */
function markupFor(util: number, isWeekend: boolean, isHoliday: boolean): number {
  let m = 0;
  if (util >= 0.85) m = 20;
  else if (util >= 0.75) m = 15;
  else if (util >= 0.6) m = 10;
  else if (util >= 0.4) m = 5;
  if (isWeekend) m += 5;
  if (isHoliday) m += 10;
  return Math.min(30, m);
}

/**
 * Returns a per-day occupancy slice from today up to N days ahead (default 30).
 * For each day, counts vehicles that are either:
 *   (a) bound by a contract whose start..end window covers that day, OR
 *   (b) blocked by a calendar event of kind 'maintenance' on that day.
 * Vehicles in status 'wartung' are excluded from `totalCount` for that day.
 */
export async function getFleetOccupancyForecast(
  workspaceId: string,
  days = 30
): Promise<OccupancyDay[]> {
  const db = getDb();

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const horizon = new Date(now.getTime() + days * 86_400_000);

  const vehicles = await db.query.vehicles.findMany({
    where: eq(s.vehicles.workspaceId, workspaceId),
    columns: { id: true, status: true },
  });
  const totalVehicles = vehicles.length;

  if (totalVehicles === 0) return [];

  const contracts = await db.query.contracts.findMany({
    where: and(
      eq(s.contracts.workspaceId, workspaceId),
      // Need contracts whose window intersects [now, horizon]
      lte(s.contracts.startsAt, horizon),
      gte(s.contracts.endsAt, now)
    ),
    columns: { id: true, vehicleId: true, startsAt: true, endsAt: true, status: true },
  });

  // Per-day booked sets (vehicleId)
  const dayMap = new Map<string, Set<string>>();
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() + i * 86_400_000);
    dayMap.set(d.toISOString().slice(0, 10), new Set());
  }
  for (const c of contracts) {
    if (!c.vehicleId || !c.startsAt || !c.endsAt) continue;
    if (c.status === 'storniert') continue;
    const start = new Date(c.startsAt);
    const end = new Date(c.endsAt);
    for (let i = 0; i < days; i++) {
      const d = new Date(now.getTime() + i * 86_400_000);
      if (d >= start && d <= end) {
        const set = dayMap.get(d.toISOString().slice(0, 10));
        set?.add(c.vehicleId);
      }
    }
  }

  // Weekend / holiday detection + markup calc
  const out: OccupancyDay[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() + i * 86_400_000);
    const iso = d.toISOString().slice(0, 10);
    const set = dayMap.get(iso) ?? new Set();
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    let { isHoliday, name } = isHolidayDate(d);

    // Soften: also boost if within 2 days of a holiday
    if (!isHoliday) {
      for (const key of Object.keys(GERMAN_HOLIDAYS_2026)) {
        const hd = new Date(key);
        if (daysAround(hd, d) <= 2) {
          isHoliday = true;
          name = `nahe ${GERMAN_HOLIDAYS_2026[key]}`;
          break;
        }
      }
    }

    const util = set.size / totalVehicles;
    out.push({
      date: iso,
      bookedCount: set.size,
      totalCount: totalVehicles,
      utilization: util,
      isWeekend,
      isHoliday,
      holidayName: name,
      recommendedMarkupPct: markupFor(util, isWeekend, isHoliday),
    });
  }
  return out;
}

export type PricingInsight = {
  windowStart: string;
  windowEnd: string;
  reason: string;
  recommendedMarkupPct: number;
  avgUtilization: number;
};

/**
 * Roll the per-day forecast into actionable windows: a run of 2+ consecutive
 * days where the recommended markup is >= 10% gets surfaced as one insight.
 * This is the "press release" version the user sees on the dashboard.
 */
export function rollUpInsights(days: OccupancyDay[]): PricingInsight[] {
  const insights: PricingInsight[] = [];
  let i = 0;
  while (i < days.length) {
    if (days[i].recommendedMarkupPct < 10) {
      i++;
      continue;
    }
    let j = i;
    while (
      j + 1 < days.length &&
      days[j + 1].recommendedMarkupPct >= 10
    ) {
      j++;
    }
    if (j - i + 1 >= 2) {
      const slice = days.slice(i, j + 1);
      const maxMarkup = Math.max(...slice.map((d) => d.recommendedMarkupPct));
      const avgUtil = slice.reduce((a, b) => a + b.utilization, 0) / slice.length;
      const holidayNames = Array.from(
        new Set(slice.filter((d) => d.isHoliday).map((d) => d.holidayName).filter(Boolean))
      );
      const reasonParts: string[] = [];
      if (holidayNames.length > 0) reasonParts.push(holidayNames.join(' / '));
      if (avgUtil >= 0.7) reasonParts.push(`${Math.round(avgUtil * 100)}% Auslastung`);
      const reason =
        reasonParts.length > 0
          ? reasonParts.join(' · ')
          : `${Math.round(avgUtil * 100)}% Auslastung`;
      insights.push({
        windowStart: slice[0].date,
        windowEnd: slice[slice.length - 1].date,
        reason,
        recommendedMarkupPct: maxMarkup,
        avgUtilization: avgUtil,
      });
    }
    i = j + 1;
  }
  return insights;
}
