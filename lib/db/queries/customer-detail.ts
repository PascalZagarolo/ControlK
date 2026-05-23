import 'server-only';
import { and, desc, eq, gt, inArray, isNotNull, lte, sql } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';
import { formatCents, formatRelativeTo } from '../format';
import type {
  ContractTimelineItem,
  Customer,
  CustomerDamagePattern,
  CustomerForecast,
  CustomerHealth,
  CustomerTag,
  FleetInUseItem,
  MergedActivityEntry,
  TodoUser,
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

function toTag(row: any): CustomerTag {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    color: row.color ?? undefined,
  };
}

// ─── Health-Score ─────────────────────────────────────────────
export function computeHealth(input: {
  contractsActive: number;
  contractsHistorical: number;
  daysSinceLastTouch: number;
  damagesOverFleetAvg: number; // 1 = same, 2 = double
  forecastCents: number;
  onboardingComplete: number;  // 0-1
  spark: number[];
}): CustomerHealth {
  // Activity (40): contracts factor
  const activity = Math.min(40, input.contractsActive * 10 + input.contractsHistorical * 1.5);

  // Touchpoints (25): inverse to days-since-last-touch
  let touchpoints = 25;
  if (input.daysSinceLastTouch > 60) touchpoints = 0;
  else if (input.daysSinceLastTouch > 30) touchpoints = 5;
  else if (input.daysSinceLastTouch > 14) touchpoints = 12;
  else if (input.daysSinceLastTouch > 7) touchpoints = 18;

  // Damages (15): inverse — high rate hurts
  const damages = Math.max(0, 15 - Math.max(0, input.damagesOverFleetAvg - 1) * 7);

  // Forecast (10)
  const forecast = Math.min(10, input.forecastCents / 200_000); // 2000€/mo → 10

  // Onboarding (10)
  const onboarding = input.onboardingComplete * 10;

  const score = Math.round(activity + touchpoints + damages + forecast + onboarding);
  return {
    score: Math.min(100, score),
    components: {
      activity: Math.round(activity),
      touchpoints: Math.round(touchpoints),
      damages: Math.round(damages),
      forecast: Math.round(forecast),
      onboarding: Math.round(onboarding),
    },
    spark: input.spark,
  };
}

// ─── Renewal-Probability heuristic ────────────────────────────
export function computeRenewalProbability(input: {
  contractsAll: number;
  contractsActive: number;
  contractsStorniert: number;
  daysSinceLastTouch: number;
  damagesOverFleetAvg: number;
}): number {
  if (input.contractsAll === 0) return 0;
  const renewalRate = (input.contractsActive + Math.max(0, input.contractsAll - input.contractsActive - input.contractsStorniert)) / input.contractsAll;
  let p = renewalRate;
  if (input.daysSinceLastTouch <= 7) p += 0.15;
  else if (input.daysSinceLastTouch >= 30) p -= 0.15;
  if (input.damagesOverFleetAvg > 2) p -= 0.1;
  return Math.max(0, Math.min(1, p));
}

// ─── Fleet-In-Use ─────────────────────────────────────────────
export async function getFleetInUse(
  workspaceId: string,
  customerId: string
): Promise<FleetInUseItem[]> {
  const db = getDb();
  const now = new Date();
  // Vehicles linked through active contracts of this customer
  const rows = await db
    .select({
      vehicleId: s.vehicles.id,
      plate: s.vehicles.plate,
      model: s.vehicles.model,
      contractTitle: s.contracts.title,
      startsAt: s.contracts.startsAt,
      endsAt: s.contracts.endsAt,
    })
    .from(s.calendarEvents)
    .innerJoin(s.vehicles, eq(s.calendarEvents.linkedVehicleId, s.vehicles.id))
    .leftJoin(s.contracts, eq(s.calendarEvents.linkedContractId, s.contracts.id))
    .where(
      and(
        eq(s.calendarEvents.workspaceId, workspaceId),
        eq(s.calendarEvents.linkedCustomerId, customerId),
        lte(s.calendarEvents.startsAt, now),
        gt(s.calendarEvents.endsAt, now)
      )
    );
  if (rows.length > 0) {
    return rows.map((r) => ({
      vehicleId: r.vehicleId,
      plate: r.plate,
      model: r.model,
      contractTitle: r.contractTitle ?? undefined,
      startsAt: r.startsAt?.toISOString(),
      endsAt: r.endsAt?.toISOString(),
    }));
  }
  // Fallback: active contracts → vehicles via vehicle-status='vermietet' (rough)
  return [];
}

// ─── Contract Timeline ────────────────────────────────────────
export async function getContractTimeline(
  workspaceId: string,
  customerId: string
): Promise<ContractTimelineItem[]> {
  const db = getDb();
  const rows = await db.query.contracts.findMany({
    where: and(
      eq(s.contracts.workspaceId, workspaceId),
      eq(s.contracts.customerId, customerId)
    ),
    orderBy: [s.contracts.startsAt],
    columns: {
      id: true,
      title: true,
      status: true,
      startsAt: true,
      endsAt: true,
      valueCents: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    startsAt: r.startsAt?.toISOString(),
    endsAt: r.endsAt?.toISOString(),
    valueCents: r.valueCents ?? 0,
  }));
}

// ─── Merged Activity ──────────────────────────────────────────
export async function getMergedActivity(
  workspaceId: string,
  customerId: string,
  channelIds: string[],
  limit = 50
): Promise<MergedActivityEntry[]> {
  const db = getDb();
  const entries: MergedActivityEntry[] = [];

  // 1. customer_activity (legacy)
  const acts = await db.query.customerActivity.findMany({
    where: eq(s.customerActivity.customerId, customerId),
    orderBy: [desc(s.customerActivity.occurredAt)],
    limit,
  });
  for (const a of acts) {
    entries.push({
      id: `act-${a.id}`,
      kind: 'note',
      title: a.title,
      detail: a.detail ?? undefined,
      occurredAt: a.occurredAt.toISOString(),
    });
  }

  // 2. Contracts events (created + started + ended + storniert)
  const contracts = await db.query.contracts.findMany({
    where: and(
      eq(s.contracts.workspaceId, workspaceId),
      eq(s.contracts.customerId, customerId)
    ),
    columns: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      startsAt: true,
      endsAt: true,
      valueCents: true,
    },
  });
  for (const c of contracts) {
    entries.push({
      id: `c-created-${c.id}`,
      kind: 'contract_created',
      title: `Vertrag „${c.title}" angelegt`,
      detail: c.valueCents ? formatCents(c.valueCents) : undefined,
      occurredAt: c.createdAt.toISOString(),
      link: { href: `/vertraege/${c.id}`, label: 'Öffnen' },
    });
    if (c.startsAt) {
      entries.push({
        id: `c-started-${c.id}`,
        kind: 'contract_started',
        title: `Vertrag „${c.title}" gestartet`,
        occurredAt: c.startsAt.toISOString(),
        link: { href: `/vertraege/${c.id}`, label: 'Öffnen' },
      });
    }
    if (c.endsAt && c.endsAt < new Date() && c.status !== 'aktiv') {
      entries.push({
        id: `c-ended-${c.id}`,
        kind: c.status === 'storniert' ? 'contract_storniert' : 'contract_ended',
        title:
          c.status === 'storniert'
            ? `Vertrag „${c.title}" storniert`
            : `Vertrag „${c.title}" abgelaufen`,
        occurredAt: c.endsAt.toISOString(),
        link: { href: `/vertraege/${c.id}`, label: 'Öffnen' },
      });
    }
  }

  // 3. Channel messages (linked channels only)
  if (channelIds.length > 0) {
    const msgs = await db.query.messages.findMany({
      where: inArray(s.messages.channelId, channelIds),
      orderBy: [desc(s.messages.createdAt)],
      limit: 30,
      with: {
        author: true,
        channel: { columns: { name: true, slug: true } },
      },
    });
    for (const m of msgs) {
      entries.push({
        id: `m-${m.id}`,
        kind: 'message',
        title: `in #${m.channel.name}`,
        detail: m.body.length > 140 ? m.body.slice(0, 137) + '…' : m.body,
        occurredAt: m.createdAt.toISOString(),
        actor: toUser(m.author),
        link: { href: `/channels/${m.channel.slug}`, label: 'Channel öffnen' },
      });
    }
  }

  // 4. Todos that link to this customer
  const todos = await db.query.todos.findMany({
    where: and(
      eq(s.todos.workspaceId, workspaceId),
      eq(s.todos.customerId, customerId)
    ),
    orderBy: [desc(s.todos.updatedAt)],
    limit: 25,
    columns: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      completedAt: true,
    },
    with: { createdBy: true, assignee: true },
  });
  for (const t of todos) {
    entries.push({
      id: `t-created-${t.id}`,
      kind: 'todo_created',
      title: `Todo „${t.title}" angelegt`,
      occurredAt: t.createdAt.toISOString(),
      actor: toUser((t as any).createdBy),
      link: { href: `/todos?todo=${t.id}`, label: 'Öffnen' },
    });
    if (t.completedAt) {
      entries.push({
        id: `t-done-${t.id}`,
        kind: 'todo_completed',
        title: `Todo „${t.title}" erledigt`,
        occurredAt: t.completedAt.toISOString(),
        actor: toUser((t as any).assignee),
        link: { href: `/todos?todo=${t.id}`, label: 'Öffnen' },
      });
    }
  }

  // 5. Calendar events
  const events = await db.query.calendarEvents.findMany({
    where: and(
      eq(s.calendarEvents.workspaceId, workspaceId),
      eq(s.calendarEvents.linkedCustomerId, customerId)
    ),
    orderBy: [desc(s.calendarEvents.startsAt)],
    limit: 20,
  });
  for (const e of events) {
    entries.push({
      id: `e-${e.id}`,
      kind: 'calendar_event',
      title: e.title,
      detail: e.kind,
      occurredAt: e.startsAt.toISOString(),
      link: { href: `/kalender`, label: 'Kalender' },
    });
  }

  // Sort merged feed desc by time
  entries.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  return entries.slice(0, limit);
}

// ─── Channel Heatmap ──────────────────────────────────────────
export async function getChannelHeatmap(
  channelIds: string[]
): Promise<number[][] | undefined> {
  if (channelIds.length === 0) return undefined;
  const db = getDb();
  const since = new Date(Date.now() - 30 * DAY_MS);
  const rows = await db.execute<{ dow: number; hour: number; n: string | number }>(sql`
    SELECT
      EXTRACT(DOW FROM ${s.messages.createdAt})::int AS dow,
      EXTRACT(HOUR FROM ${s.messages.createdAt})::int AS hour,
      COUNT(*) AS n
    FROM ${s.messages}
    WHERE ${s.messages.channelId} = ANY(${sql.raw(`ARRAY[${channelIds.map((id) => `'${id}'`).join(',')}]::uuid[]`)})
      AND ${s.messages.createdAt} >= ${since}
    GROUP BY dow, hour
  `);
  const list: any[] = Array.isArray((rows as any).rows) ? (rows as any).rows : (rows as any);
  // 7 days × 24 hours
  const grid: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const r of list) {
    grid[r.dow][r.hour] = Number(r.n);
  }
  return grid;
}

// ─── Damage Pattern ──────────────────────────────────────────
export async function getDamagePattern(
  workspaceId: string,
  customerId: string
): Promise<CustomerDamagePattern> {
  // Damages stored where? Schema doesn't have a `damages` table. Use customer_activity rows with kind LIKE '%damage%' as proxy.
  // For now: return zeros if no damage tracking exists. Future: dedicated damages table.
  const db = getDb();
  const total = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(s.customerActivity)
    .where(
      and(
        eq(s.customerActivity.customerId, customerId),
        sql`${s.customerActivity.kind} ILIKE '%schaden%' OR ${s.customerActivity.kind} ILIKE '%damage%'`
      )
    );
  const customerTotal = Number(total[0]?.n ?? 0);

  // Fleet average — total damage activity / number of customers with activity, in this workspace
  const fleet = await db
    .select({
      total: sql<number>`COUNT(*)`,
      customers: sql<number>`COUNT(DISTINCT ${s.customerActivity.customerId})`,
    })
    .from(s.customerActivity)
    .innerJoin(s.customers, eq(s.customerActivity.customerId, s.customers.id))
    .where(
      and(
        eq(s.customers.workspaceId, workspaceId),
        sql`${s.customerActivity.kind} ILIKE '%schaden%' OR ${s.customerActivity.kind} ILIKE '%damage%'`
      )
    );
  const fleetTotal = Number(fleet[0]?.total ?? 0);
  const fleetCust = Math.max(1, Number(fleet[0]?.customers ?? 1));
  const fleetAvg = fleetTotal / fleetCust;
  const delta = fleetAvg > 0 ? ((customerTotal - fleetAvg) / fleetAvg) * 100 : 0;
  return {
    customerRate: customerTotal,
    fleetAvg,
    deltaPercent: Math.round(delta),
    totalDamages: customerTotal,
  };
}

// ─── Mentions Count ──────────────────────────────────────────
export async function getMentionsCount(
  workspaceId: string,
  customerId: string,
  customerName: string
): Promise<{ channels: number; contracts: number; todos: number }> {
  const db = getDb();
  const pattern = `%${customerName}%`;

  const [channelCount, contractCount, todoCount] = await Promise.all([
    db
      .select({ n: sql<number>`COUNT(DISTINCT ${s.messages.channelId})` })
      .from(s.messages)
      .innerJoin(s.channels, eq(s.messages.channelId, s.channels.id))
      .where(and(eq(s.channels.workspaceId, workspaceId), sql`${s.messages.body} ILIKE ${pattern}`)),
    db
      .select({ n: sql<number>`COUNT(*)` })
      .from(s.contracts)
      .where(and(eq(s.contracts.workspaceId, workspaceId), eq(s.contracts.customerId, customerId))),
    db
      .select({ n: sql<number>`COUNT(*)` })
      .from(s.todos)
      .where(and(eq(s.todos.workspaceId, workspaceId), eq(s.todos.customerId, customerId))),
  ]);

  return {
    channels: Number(channelCount[0]?.n ?? 0),
    contracts: Number(contractCount[0]?.n ?? 0),
    todos: Number(todoCount[0]?.n ?? 0),
  };
}

// ─── 7-day Activity Sparkline ────────────────────────────────
export async function getActivitySpark(
  workspaceId: string,
  customerId: string,
  channelIds: string[]
): Promise<number[]> {
  const db = getDb();
  const since = new Date(Date.now() - 6 * DAY_MS);
  since.setHours(0, 0, 0, 0);

  const buckets: number[] = Array.from({ length: 7 }, () => 0);
  const indexFor = (d: Date) => {
    const t = new Date(d);
    t.setHours(0, 0, 0, 0);
    return Math.min(6, Math.max(0, Math.floor((t.getTime() - since.getTime()) / DAY_MS)));
  };

  // Customer activity
  const acts = await db.query.customerActivity.findMany({
    where: and(
      eq(s.customerActivity.customerId, customerId),
      sql`${s.customerActivity.occurredAt} >= ${since}`
    ),
    columns: { occurredAt: true },
  });
  for (const a of acts) buckets[indexFor(a.occurredAt)] += 1;

  // Channel messages
  if (channelIds.length > 0) {
    const msgs = await db.query.messages.findMany({
      where: and(
        inArray(s.messages.channelId, channelIds),
        sql`${s.messages.createdAt} >= ${since}`
      ),
      columns: { createdAt: true },
    });
    for (const m of msgs) buckets[indexFor(m.createdAt)] += 1;
  }

  // Todo events
  const todos = await db.query.todos.findMany({
    where: and(
      eq(s.todos.workspaceId, workspaceId),
      eq(s.todos.customerId, customerId),
      sql`${s.todos.updatedAt} >= ${since}`
    ),
    columns: { updatedAt: true },
  });
  for (const t of todos) buckets[indexFor(t.updatedAt)] += 1;

  return buckets;
}

// ─── Full enriched customer ──────────────────────────────────
export async function getCustomerFullBySlug(
  workspaceId: string,
  slug: string
): Promise<Customer | null> {
  const db = getDb();
  const row: any = await db.query.customers.findFirst({
    where: and(eq(s.customers.workspaceId, workspaceId), eq(s.customers.slug, slug)),
    with: {
      contacts: true,
      activity: { orderBy: [desc(s.customerActivity.occurredAt)] },
      contracts: true,
      linkedChannels: { with: { channel: true } },
      owner: true,
      tagAssignments: { with: { tag: true } },
    },
  });
  if (!row) return null;

  const channelIds = row.linkedChannels.map((cc: any) => cc.channel.id);
  const customerId = row.id;
  const customerName = row.name;

  const [fleetInUse, timeline, merged, heatmap, damages, mentions, spark] = await Promise.all([
    getFleetInUse(workspaceId, customerId),
    getContractTimeline(workspaceId, customerId),
    getMergedActivity(workspaceId, customerId, channelIds, 80),
    getChannelHeatmap(channelIds),
    getDamagePattern(workspaceId, customerId),
    getMentionsCount(workspaceId, customerId, customerName),
    getActivitySpark(workspaceId, customerId, channelIds),
  ]);

  const now = Date.now();
  const lastTouchpointTs = merged[0]
    ? new Date(merged[0].occurredAt).getTime()
    : row.activity[0]?.occurredAt?.getTime?.() ?? null;
  const daysSinceLastTouch =
    lastTouchpointTs != null ? Math.floor((now - lastTouchpointTs) / DAY_MS) : 9999;

  const activeContracts = row.contracts.filter((c: any) => c.status === 'aktiv').length;
  const totalCents = row.contracts
    .filter((c: any) => c.status === 'aktiv')
    .reduce((acc: number, c: any) => acc + (c.valueCents ?? 0), 0);
  const atRiskCents = row.contracts
    .filter((c: any) => c.status === 'auslaufend')
    .reduce((acc: number, c: any) => acc + (c.valueCents ?? 0), 0);
  const pipelineCents = row.contracts
    .filter((c: any) => c.status === 'entwurf')
    .reduce((acc: number, c: any) => acc + (c.valueCents ?? 0) * 0.5, 0);

  const contractsAll = row.contracts.length;
  const contractsStorniert = row.contracts.filter((c: any) => c.status === 'storniert').length;
  const damagesRatio = damages.fleetAvg > 0 ? damages.customerRate / damages.fleetAvg : 1;

  const onboardingProgress: Record<string, boolean> = row.onboardingProgress ?? {};
  const onboardingDoneCount = Object.values(onboardingProgress).filter(Boolean).length;
  const onboardingRatio = onboardingDoneCount / 5;

  const health = computeHealth({
    contractsActive: activeContracts,
    contractsHistorical: Math.max(0, contractsAll - activeContracts),
    daysSinceLastTouch,
    damagesOverFleetAvg: damagesRatio,
    forecastCents: totalCents,
    onboardingComplete: onboardingRatio,
    spark,
  });

  const renewal = computeRenewalProbability({
    contractsAll,
    contractsActive: activeContracts,
    contractsStorniert,
    daysSinceLastTouch,
    damagesOverFleetAvg: damagesRatio,
  });

  const forecast: CustomerForecast = {
    activeMrcCents: totalCents,
    atRiskCents,
    pipelineCents,
  };

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
    totalValue: totalCents > 0 ? formatCents(totalCents) : '€ 0',
    lastTouchpoint: formatRelativeTo(merged[0]?.occurredAt ? new Date(merged[0].occurredAt) : null),
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
    owner: toUser(row.owner),
    tags: (row.tagAssignments ?? []).map((ta: any) => toTag(ta.tag)),
    health,
    forecast,
    fleetInUse,
    contractTimeline: timeline,
    mergedActivity: merged,
    renewalProbability: renewal,
    quietDays: daysSinceLastTouch,
    damagePattern: damages,
    onboardingProgress,
    onboardingStartedAt: row.onboardingStartedAt?.toISOString(),
    mentions,
    channelHeatmap: heatmap,
  };
}
