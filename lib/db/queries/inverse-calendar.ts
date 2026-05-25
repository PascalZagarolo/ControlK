import 'server-only';
import { and, desc, eq, or, isNull, lt } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';
import { severityFor, type Severity } from '@/lib/inverse/threshold-math';

export type StandstillRow = {
  id: string;
  entityType: 'person' | 'customer' | 'project' | 'channel' | 'note';
  entityId: string;
  entityDisplayName: string;
  totalInteractions: number;
  lastInteractionAt: string | null;
  medianDaysBetween: number | null;
  alertThresholdDays: number;
  daysSilent: number;
  severity: Severity;
  importanceScore: number;
  acknowledged: boolean;
};

export async function listStandstills(userId: string): Promise<StandstillRow[]> {
  const db = getDb();
  const now = new Date();
  const rows = await db.query.entityThresholds.findMany({
    where: and(
      eq(s.entityThresholds.userId, userId),
      eq(s.entityThresholds.isInStandstill, true),
      eq(s.entityThresholds.isMuted, false),
      or(
        isNull(s.entityThresholds.mutedUntil),
        lt(s.entityThresholds.mutedUntil, now)
      )!
    ),
    orderBy: [desc(s.entityThresholds.importanceScore)],
  });
  return rows.map((r: any) => {
    const lastAt = r.lastInteractionAt ?? null;
    const daysSilent = lastAt
      ? (now.getTime() - new Date(lastAt).getTime()) / 86_400_000
      : 0;
    const effectiveThreshold = r.userSetThreshold ?? r.alertThresholdDays;
    return {
      id: r.id,
      entityType: r.entityType,
      entityId: r.entityId,
      entityDisplayName: r.entityDisplayName,
      totalInteractions: r.totalInteractions,
      lastInteractionAt: lastAt ? new Date(lastAt).toISOString() : null,
      medianDaysBetween: r.medianDaysBetween,
      alertThresholdDays: effectiveThreshold,
      daysSilent: Math.round(daysSilent),
      severity: severityFor(daysSilent, effectiveThreshold),
      importanceScore: r.importanceScore,
      acknowledged: !!r.lastAcknowledgedAt,
    };
  });
}

export async function countActivity(userId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: s.activityLog.id })
    .from(s.activityLog)
    .where(eq(s.activityLog.userId, userId))
    .limit(1);
  return rows.length;
}
