import 'server-only';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { PLANS, type PlanTier, isAtLeast } from './plans';

/**
 * Plan gating helpers — used by server actions before performing actions
 * that should be plan-restricted. The brief is explicit: do NOT gate
 * permissions or the API. ONLY quota-style limits live here.
 */

export async function getWorkspacePlan(workspaceId: string): Promise<PlanTier> {
  const db = getDb();
  const row = await db.query.subscriptions.findFirst({
    where: eq(s.subscriptions.workspaceId, workspaceId),
    columns: { plan: true },
  });
  return (row?.plan as PlanTier) ?? 'free';
}

export async function requirePlan(
  workspaceId: string,
  minimum: PlanTier
): Promise<{ ok: true } | { ok: false; current: PlanTier; required: PlanTier }> {
  const current = await getWorkspacePlan(workspaceId);
  if (isAtLeast(current, minimum)) return { ok: true };
  return { ok: false, current, required: minimum };
}

/**
 * Check a quota against the workspace's current plan. Returns the remaining
 * budget so the caller can present a friendly "X von N" pill.
 */
export async function checkQuota(
  workspaceId: string,
  quota: keyof typeof PLANS.free.features,
  current: number
): Promise<{ allowed: boolean; limit: number; remaining: number; plan: PlanTier }> {
  const plan = await getWorkspacePlan(workspaceId);
  const limit = PLANS[plan].features[quota] as number;
  // 0 sentinel = unlimited
  if (limit === 0) {
    return { allowed: true, limit: Infinity, remaining: Infinity, plan };
  }
  return {
    allowed: current < limit,
    limit,
    remaining: Math.max(0, limit - current),
    plan,
  };
}
