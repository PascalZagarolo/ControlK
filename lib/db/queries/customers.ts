import 'server-only';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';
import { formatCents, formatRelativeTo } from '../format';
import { computeHealth, computeRenewalProbability, getActivitySpark } from './customer-detail';
import type { Customer, CustomerTag } from '@/lib/types';

const DAY_MS = 86_400_000;

export async function listCustomers(workspaceId: string): Promise<Customer[]> {
  const db = getDb();
  const rows = await db.query.customers.findMany({
    where: eq(s.customers.workspaceId, workspaceId),
    orderBy: [asc(s.customers.name)],
    with: {
      contacts: true,
      activity: { orderBy: [desc(s.customerActivity.occurredAt)], limit: 5 },
      contracts: true,
      linkedChannels: { with: { channel: true } },
      owner: true,
      tagAssignments: { with: { tag: true } },
    },
  });

  return rows.map(toCustomer);
}

/**
 * Cursor-paginated customer list. Sort: name asc, id asc tiebreaker.
 * Light shape — caller can fetch detail on click via getCustomerFullBySlug.
 */
export async function listCustomersPage(
  workspaceId: string,
  opts: {
    cursor?: string | null;
    limit?: number;
    statusFilter?: 'aktiv' | 'lead' | 'inaktiv';
    q?: string;
  } = {}
): Promise<import('@/lib/db/cursor').Page<Customer>> {
  const cursorMod = await import('@/lib/db/cursor');
  const db = getDb();
  const limit = cursorMod.clampLimit(opts.limit, 50);
  const conditions = [eq(s.customers.workspaceId, workspaceId)];
  if (opts.statusFilter) conditions.push(eq(s.customers.status, opts.statusFilter));
  if (opts.q?.trim()) {
    conditions.push(sql`lower(${s.customers.name}) LIKE ${'%' + opts.q.trim().toLowerCase() + '%'}`);
  }
  const cursor = cursorMod.decodeCursor<string>(opts.cursor ?? null);
  if (cursor) {
    conditions.push(sql`(lower(${s.customers.name}), ${s.customers.id}) > (${(cursor.v ?? '').toLowerCase()}, ${cursor.id})`);
  }

  const rows = await db.query.customers.findMany({
    where: and(...conditions),
    orderBy: [asc(sql`lower(${s.customers.name})`), asc(s.customers.id)],
    with: {
      contacts: { limit: 1 },
      contracts: { columns: { id: true, status: true } },
      owner: true,
      tagAssignments: { with: { tag: true } },
    },
    limit: limit + 1,
  });
  const hasMore = rows.length > limit;
  const items = (hasMore ? rows.slice(0, limit) : rows).map(toCustomer);
  const last = items[items.length - 1];
  const nextCursor = hasMore && last ? cursorMod.encodeCursor({ v: last.name, id: last.id }) : null;
  return { items, nextCursor, hasMore };
}

/**
 * List with enrichments: health-score + sparkline + forecast + tags. Heavier query — use on list page.
 */
export async function listCustomersDetailed(workspaceId: string): Promise<Customer[]> {
  const db = getDb();
  const rows = await db.query.customers.findMany({
    where: eq(s.customers.workspaceId, workspaceId),
    orderBy: [asc(s.customers.name)],
    with: {
      contacts: true,
      activity: { orderBy: [desc(s.customerActivity.occurredAt)], limit: 5 },
      contracts: true,
      linkedChannels: { with: { channel: true } },
      owner: true,
      tagAssignments: { with: { tag: true } },
    },
  });
  if (rows.length === 0) return [];

  const now = Date.now();
  const enriched: Customer[] = [];
  for (const row of rows) {
    const base = toCustomer(row);
    const channelIds = (row as any).linkedChannels.map((cc: any) => cc.channel.id);

    const activeContracts = row.contracts.filter((c: any) => c.status === 'aktiv').length;
    const contractsAll = row.contracts.length;
    const contractsStorniert = row.contracts.filter((c: any) => c.status === 'storniert').length;
    const totalCents = row.contracts
      .filter((c: any) => c.status === 'aktiv')
      .reduce((acc: number, c: any) => acc + (c.valueCents ?? 0), 0);
    const atRiskCents = row.contracts
      .filter((c: any) => c.status === 'auslaufend')
      .reduce((acc: number, c: any) => acc + (c.valueCents ?? 0), 0);
    const pipelineCents = row.contracts
      .filter((c: any) => c.status === 'entwurf')
      .reduce((acc: number, c: any) => acc + (c.valueCents ?? 0) * 0.5, 0);

    const lastTs = row.activity[0]?.occurredAt?.getTime?.() ?? null;
    const daysSinceLastTouch =
      lastTs != null ? Math.floor((now - lastTs) / DAY_MS) : 9999;

    const onboardingProgress = (row as any).onboardingProgress ?? {};
    const onboardingDone = Object.values(onboardingProgress).filter(Boolean).length;
    const onboardingRatio = onboardingDone / 5;

    const spark = await getActivitySpark(workspaceId, row.id, channelIds);
    const health = computeHealth({
      contractsActive: activeContracts,
      contractsHistorical: Math.max(0, contractsAll - activeContracts),
      daysSinceLastTouch,
      damagesOverFleetAvg: 1,
      forecastCents: totalCents,
      onboardingComplete: onboardingRatio,
      spark,
    });
    const renewal = computeRenewalProbability({
      contractsAll,
      contractsActive: activeContracts,
      contractsStorniert,
      daysSinceLastTouch,
      damagesOverFleetAvg: 1,
    });

    enriched.push({
      ...base,
      dbId: row.id,
      health,
      renewalProbability: renewal,
      quietDays: daysSinceLastTouch,
      forecast: { activeMrcCents: totalCents, atRiskCents, pipelineCents },
      onboardingProgress,
      onboardingStartedAt: (row as any).onboardingStartedAt?.toISOString(),
    });
  }
  return enriched;
}

export async function smartCustomerCounts(workspaceId: string, currentUserId?: string) {
  const db = getDb();
  const all = await db.query.customers.findMany({
    where: eq(s.customers.workspaceId, workspaceId),
    columns: { id: true, status: true, ownerId: true },
    with: {
      activity: { orderBy: [desc(s.customerActivity.occurredAt)], limit: 1 },
      contracts: { columns: { status: true, endsAt: true } },
    },
  });
  const now = Date.now();
  let active = 0,
    lead = 0,
    inactive = 0,
    risk = 0,
    quiet = 0,
    expiring = 0,
    onboarding = 0,
    mine = 0;
  for (const c of all) {
    if (c.status === 'aktiv') active += 1;
    if (c.status === 'lead') lead += 1;
    if (c.status === 'inaktiv') inactive += 1;
    if (currentUserId && c.ownerId === currentUserId) mine += 1;
    const lastTs = (c as any).activity[0]?.occurredAt?.getTime?.() ?? null;
    const days = lastTs != null ? Math.floor((now - lastTs) / DAY_MS) : 9999;
    if (c.status === 'aktiv' && days >= 14) quiet += 1;
    const exp = (c as any).contracts.some((co: any) => {
      if (co.status !== 'auslaufend' || !co.endsAt) return false;
      const left = Math.ceil((co.endsAt.getTime() - now) / DAY_MS);
      return left >= 0 && left <= 30;
    });
    if (exp) expiring += 1;
    if (c.status === 'lead') onboarding += 1;
  }
  // Risk = active + quiet ≥ 14d (proxy)
  risk = quiet;
  return {
    all: all.length,
    active,
    lead,
    inactive,
    risk,
    quiet,
    expiring,
    onboarding,
    mine,
  };
}

export async function listCustomerTags(workspaceId: string): Promise<CustomerTag[]> {
  const db = getDb();
  const rows = await db.query.customerTags.findMany({
    where: eq(s.customerTags.workspaceId, workspaceId),
    orderBy: [asc(s.customerTags.name)],
  });
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    color: r.color ?? undefined,
  }));
}

export async function getCustomerBySlug(
  workspaceId: string,
  slug: string
): Promise<Customer | null> {
  const db = getDb();
  const row = await db.query.customers.findFirst({
    where: and(eq(s.customers.workspaceId, workspaceId), eq(s.customers.slug, slug)),
    with: {
      contacts: true,
      activity: { orderBy: [desc(s.customerActivity.occurredAt)] },
      contracts: true,
      linkedChannels: { with: { channel: true } },
    },
  });
  if (!row) return null;
  return toCustomer(row);
}

function toCustomer(row: any): Customer {
  const activeContracts = row.contracts.filter((c: any) => c.status === 'aktiv').length;
  const totalCents = row.contracts
    .filter((c: any) => c.status === 'aktiv')
    .reduce((sum: number, c: any) => sum + (c.valueCents ?? 0), 0);
  const lastActivity = row.activity[0];

  return {
    id: row.slug,
    dbId: row.id,
    name: row.name,
    industry: row.industry ?? '',
    status: row.status,
    initials: row.initials,
    from: row.fromColor,
    to: row.toColor,
    contacts: row.contacts.map((c: any) => ({
      id: c.id,
      name: c.name,
      role: c.role ?? '',
      email: c.email ?? '',
      phone: c.phone ?? undefined,
    })),
    activeContracts,
    totalValue: totalCents > 0 ? formatCents(totalCents) : row.contracts.length === 0 ? '€ 0' : '—',
    lastTouchpoint: formatRelativeTo(lastActivity?.occurredAt ?? null),
    linkedChannelSlugs: row.linkedChannels.map((cc: any) => cc.channel.slug),
    pinnedDocs: [],
    activity: row.activity.map((a: any) => ({
      id: a.id,
      timestamp: a.occurredAt.toISOString(),
      kind: a.kind,
      title: a.title,
      detail: a.detail ?? undefined,
    })),
    notes: row.notes ?? '',
    forecastContribution: row.forecastContribution ?? undefined,
    owner: row.owner
      ? {
          id: row.owner.id,
          name: row.owner.name,
          initials: row.owner.initials,
          from: row.owner.avatarFrom,
          to: row.owner.avatarTo,
        }
      : undefined,
    tags: (row.tagAssignments ?? []).map((ta: any) => ({
      id: ta.tag.id,
      slug: ta.tag.slug,
      name: ta.tag.name,
      color: ta.tag.color ?? undefined,
    })),
  };
}
