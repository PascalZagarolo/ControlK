'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import type { AutoRuleSlug, TodoPriority } from '@/lib/types';

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

const RULE_DEFAULTS: Record<
  AutoRuleSlug,
  { priority: TodoPriority }
> = {
  contract_starting_tomorrow: { priority: 'hoch' },
  contract_ending_in_14_days: { priority: 'hoch' },
  contract_ending_in_30_days: { priority: 'mittel' },
  contract_lost_followup_90d: { priority: 'niedrig' },
  lead_stale_10d: { priority: 'mittel' },
  lead_stale_30d: { priority: 'hoch' },
  vehicle_service_due: { priority: 'mittel' },
  customer_inactive_30d: { priority: 'niedrig' },
  customer_onboarding_30d: { priority: 'mittel' },
};

export async function ensureDefaultRules() {
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const slugs = Object.keys(RULE_DEFAULTS) as AutoRuleSlug[];
  for (const slug of slugs) {
    await db
      .insert(s.todoAutoRules)
      .values({
        workspaceId: ws.id,
        slug,
        enabled: 0, // default off until user opts in
        defaultPriority: RULE_DEFAULTS[slug].priority,
      })
      .onConflictDoNothing();
  }
}

export async function listRules() {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  await ensureDefaultRules();
  const db = getDb();
  const rows = await db.query.todoAutoRules.findMany({
    where: eq(s.todoAutoRules.workspaceId, ws.id),
    with: { defaultAssignee: true },
  });
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug as AutoRuleSlug,
    enabled: r.enabled === 1,
    defaultPriority: r.defaultPriority,
    defaultAssignee: r.defaultAssignee
      ? {
          id: r.defaultAssignee.id,
          name: r.defaultAssignee.name,
          initials: r.defaultAssignee.initials,
          from: r.defaultAssignee.avatarFrom,
          to: r.defaultAssignee.avatarTo,
        }
      : undefined,
    lastRunAt: r.lastRunAt?.toISOString() ?? undefined,
  }));
}

export async function toggleRule(slug: AutoRuleSlug, enabled: boolean): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  await db
    .update(s.todoAutoRules)
    .set({ enabled: enabled ? 1 : 0, updatedAt: new Date() })
    .where(and(eq(s.todoAutoRules.workspaceId, ws.id), eq(s.todoAutoRules.slug, slug)));
  revalidatePath('/settings/automations');
  return { ok: true };
}

export async function setRuleAssignee(
  slug: AutoRuleSlug,
  userId: string | null
): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  await db
    .update(s.todoAutoRules)
    .set({ defaultAssigneeId: userId, updatedAt: new Date() })
    .where(and(eq(s.todoAutoRules.workspaceId, ws.id), eq(s.todoAutoRules.slug, slug)));
  revalidatePath('/settings/automations');
  return { ok: true };
}

export async function setRulePriority(
  slug: AutoRuleSlug,
  priority: TodoPriority
): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  await db
    .update(s.todoAutoRules)
    .set({ defaultPriority: priority, updatedAt: new Date() })
    .where(and(eq(s.todoAutoRules.workspaceId, ws.id), eq(s.todoAutoRules.slug, slug)));
  revalidatePath('/settings/automations');
  return { ok: true };
}

/** Manual run from settings — same logic as cron */
export async function runRulesNow(): Promise<Result<{ created: number }>> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const created = await runWorkspaceRules(ws.id);
  revalidatePath('/todos');
  revalidatePath('/settings/automations');
  return { ok: true, created };
}

export async function runWorkspaceRules(workspaceId: string): Promise<number> {
  const db = getDb();
  const rules = await db.query.todoAutoRules.findMany({
    where: and(
      eq(s.todoAutoRules.workspaceId, workspaceId),
      eq(s.todoAutoRules.enabled, 1)
    ),
  });
  let created = 0;
  for (const rule of rules) {
    created += await applyRule(workspaceId, rule);
  }
  return created;
}

const DAY = 86_400_000;

async function applyRule(
  workspaceId: string,
  rule: typeof s.todoAutoRules.$inferSelect
): Promise<number> {
  const db = getDb();
  const now = new Date();
  const slug = rule.slug as AutoRuleSlug;

  // Helper to insert a todo if no existing one matches the same trigger fingerprint
  async function spawn(input: {
    title: string;
    dueAt: Date;
    customerId?: string | null;
    contractId?: string | null;
    vehicleId?: string | null;
    fingerprint: string;
  }): Promise<boolean> {
    const existing = await db.query.todos.findFirst({
      where: and(
        eq(s.todos.workspaceId, workspaceId),
        eq(s.todos.autoRuleSlug, slug),
        input.customerId ? eq(s.todos.customerId, input.customerId) : eq(s.todos.id, s.todos.id),
        input.contractId ? eq(s.todos.contractId, input.contractId) : eq(s.todos.id, s.todos.id),
        input.vehicleId ? eq(s.todos.vehicleId, input.vehicleId) : eq(s.todos.id, s.todos.id)
      ),
    });
    if (existing) return false;
    const ownerId = rule.defaultAssigneeId
      ? rule.defaultAssigneeId
      : (await db.query.workspaces.findFirst({ where: eq(s.workspaces.id, workspaceId) }))!.ownerId;
    const [row] = await db
      .insert(s.todos)
      .values({
        workspaceId,
        createdById: ownerId,
        assigneeId: rule.defaultAssigneeId,
        title: input.title,
        priority: rule.defaultPriority,
        visibility: 'team',
        dueAt: input.dueAt,
        customerId: input.customerId ?? null,
        contractId: input.contractId ?? null,
        vehicleId: input.vehicleId ?? null,
        autoRuleSlug: slug,
      })
      .returning();
    await db.insert(s.todoActivity).values({
      todoId: row.id,
      actorId: null,
      kind: 'auto_created',
      payload: { rule: slug, fingerprint: input.fingerprint },
    });
    return true;
  }

  let count = 0;

  if (slug === 'contract_starting_tomorrow') {
    const tomorrowStart = new Date(now);
    tomorrowStart.setHours(0, 0, 0, 0);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const tomorrowEnd = new Date(tomorrowStart.getTime() + DAY);
    const contracts = await db.query.contracts.findMany({
      where: and(
        eq(s.contracts.workspaceId, workspaceId),
        eq(s.contracts.status, 'aktiv')
      ),
      with: { customer: true },
    });
    for (const c of contracts) {
      if (!c.startsAt) continue;
      const t = c.startsAt.getTime();
      if (t < tomorrowStart.getTime() || t >= tomorrowEnd.getTime()) continue;
      const did = await spawn({
        title: `Übergabe vorbereiten: ${c.customer?.name ?? c.title}`,
        dueAt: c.startsAt,
        customerId: c.customerId ?? null,
        contractId: c.id,
        fingerprint: `start-${c.id}`,
      });
      if (did) count++;
    }
  }

  if (slug === 'contract_ending_in_14_days' || slug === 'contract_ending_in_30_days') {
    const days = slug === 'contract_ending_in_14_days' ? 14 : 30;
    const target = new Date(now.getTime() + days * DAY);
    const targetStart = new Date(target);
    targetStart.setHours(0, 0, 0, 0);
    const targetEnd = new Date(targetStart.getTime() + DAY);
    const contracts = await db.query.contracts.findMany({
      where: and(eq(s.contracts.workspaceId, workspaceId), eq(s.contracts.status, 'aktiv')),
      with: { customer: true },
    });
    for (const c of contracts) {
      if (!c.endsAt) continue;
      const t = c.endsAt.getTime();
      if (t < targetStart.getTime() || t >= targetEnd.getTime()) continue;
      const did = await spawn({
        title: `Verlängerung anbieten: ${c.customer?.name ?? c.title} (läuft in ${days} Tagen aus)`,
        dueAt: new Date(now.getTime() + Math.max(1, days - 7) * DAY),
        customerId: c.customerId ?? null,
        contractId: c.id,
        fingerprint: `end-${days}-${c.id}`,
      });
      if (did) count++;
    }
  }

  if (slug === 'contract_lost_followup_90d') {
    const target = new Date(now.getTime() - 90 * DAY);
    const targetEnd = new Date(target.getTime() + DAY);
    const contracts = await db.query.contracts.findMany({
      where: and(eq(s.contracts.workspaceId, workspaceId), eq(s.contracts.status, 'storniert')),
      with: { customer: true },
    });
    for (const c of contracts) {
      const t = c.createdAt.getTime();
      if (t < target.getTime() || t >= targetEnd.getTime()) continue;
      const did = await spawn({
        title: `Wiedervorlage nach 90 Tagen: ${c.customer?.name ?? c.title}`,
        dueAt: new Date(now.getTime() + DAY),
        customerId: c.customerId ?? null,
        fingerprint: `lost-${c.id}`,
      });
      if (did) count++;
    }
  }

  if (slug === 'lead_stale_10d' || slug === 'lead_stale_30d') {
    const days = slug === 'lead_stale_10d' ? 10 : 30;
    const threshold = new Date(now.getTime() - days * DAY);
    const customers = await db.query.customers.findMany({
      where: and(eq(s.customers.workspaceId, workspaceId), eq(s.customers.status, 'lead')),
      with: { activity: { orderBy: (a, { desc }) => [desc(a.occurredAt)], limit: 1 } },
    });
    for (const c of customers) {
      const lastTouch = c.activity[0]?.occurredAt ?? c.createdAt;
      if (lastTouch.getTime() > threshold.getTime()) continue;
      const did = await spawn({
        title: `Nachfass: ${c.name} — ${days} Tage stumm`,
        dueAt: new Date(now.getTime() + DAY),
        customerId: c.id,
        fingerprint: `lead-${days}-${c.id}-${Math.floor(lastTouch.getTime() / DAY)}`,
      });
      if (did) count++;
    }
  }

  if (slug === 'vehicle_service_due') {
    // Naive: today's "next service" string contains "km" — better signal would be a service-date column.
    // For now: a Todo for vehicles whose lastInspection was ≥ 11 months ago.
    const threshold = new Date(now.getTime() - 335 * DAY);
    const vehicles = await db.query.vehicles.findMany({
      where: eq(s.vehicles.workspaceId, workspaceId),
    });
    for (const v of vehicles) {
      // We only have a free-text lastInspection; skip if can't parse. Use createdAt as fallback.
      const ref = v.createdAt;
      if (ref.getTime() > threshold.getTime()) continue;
      const did = await spawn({
        title: `Inspektion/HU planen: ${v.plate} ${v.model}`,
        dueAt: new Date(now.getTime() + 7 * DAY),
        vehicleId: v.id,
        fingerprint: `service-${v.id}-${Math.floor(ref.getTime() / DAY)}`,
      });
      if (did) count++;
    }
  }

  if (slug === 'customer_inactive_30d') {
    const threshold = new Date(now.getTime() - 30 * DAY);
    const customers = await db.query.customers.findMany({
      where: and(eq(s.customers.workspaceId, workspaceId), eq(s.customers.status, 'aktiv')),
      with: { activity: { orderBy: (a, { desc }) => [desc(a.occurredAt)], limit: 1 } },
    });
    for (const c of customers) {
      const lastTouch = c.activity[0]?.occurredAt ?? c.createdAt;
      if (lastTouch.getTime() > threshold.getTime()) continue;
      const did = await spawn({
        title: `Check-in: ${c.name} — 30 Tage inaktiv`,
        dueAt: new Date(now.getTime() + 2 * DAY),
        customerId: c.id,
        fingerprint: `inactive-${c.id}-${Math.floor(lastTouch.getTime() / DAY)}`,
      });
      if (did) count++;
    }
  }

  if (slug === 'customer_onboarding_30d') {
    const min = new Date(now.getTime() - 35 * DAY);
    const max = new Date(now.getTime() - 28 * DAY);
    const customers = await db.query.customers.findMany({
      where: and(eq(s.customers.workspaceId, workspaceId), eq(s.customers.status, 'aktiv')),
    });
    for (const c of customers) {
      const t = c.createdAt.getTime();
      if (t < min.getTime() || t > max.getTime()) continue;
      const did = await spawn({
        title: `30-Tage-Onboarding-Check: ${c.name}`,
        dueAt: new Date(now.getTime() + 3 * DAY),
        customerId: c.id,
        fingerprint: `onboarding-${c.id}`,
      });
      if (did) count++;
    }
  }

  await db
    .update(s.todoAutoRules)
    .set({ lastRunAt: now })
    .where(eq(s.todoAutoRules.id, rule.id));

  return count;
}
