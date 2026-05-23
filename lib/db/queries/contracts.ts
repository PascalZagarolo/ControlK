import 'server-only';
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';
import { formatCents } from '../format';
import type {
  Contract,
  ContractMargin,
  ContractRevenueBucket,
  ContractRevision,
  ContractSignatureRecord,
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

function computeMargin(row: any): ContractMargin | undefined {
  const value = row.valueCents ?? 0;
  if (value <= 0) return undefined;
  const costs = row.estimatedCostsCents ?? 0;
  const discountPct = row.discountPct ?? 0;
  const discountedValue = Math.round(value * (1 - discountPct / 100));
  const net = discountedValue - costs;
  return {
    valueCents: discountedValue,
    costsCents: costs,
    discountPct,
    netCents: net,
    netPercent: discountedValue > 0 ? (net / discountedValue) * 100 : 0,
  };
}

function toContract(row: any): Contract {
  const startsAt = row.startsAt as Date | null;
  const endsAt = row.endsAt as Date | null;
  const now = Date.now();
  const daysToEnd = endsAt ? Math.ceil((endsAt.getTime() - now) / DAY_MS) : undefined;
  const daysActive =
    startsAt && startsAt.getTime() <= now
      ? Math.floor((now - startsAt.getTime()) / DAY_MS)
      : undefined;

  return {
    id: row.externalId ?? row.id,
    dbId: row.id,
    title: row.title,
    customerId: row.customer?.slug,
    customerName: row.customer?.name,
    customerDbId: row.customerId ?? row.customer?.id,
    status: row.status,
    templateOf: row.templateOf ?? undefined,
    value: row.status === 'vorlage' ? '—' : formatCents(row.valueCents ?? 0),
    valueCents: row.valueCents ?? 0,
    startsAt: startsAt?.toISOString(),
    endsAt: endsAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdByUser?.name ?? '—',
    body: row.body ?? [],
    owner: toUser(row.owner),
    vehicleId: row.vehicleId ?? undefined,
    vehicleExternalId: row.vehicle?.externalId ?? row.vehicle?.id,
    vehiclePlate: row.vehicle?.plate,
    vehicleModel: row.vehicle?.model,
    acceptedAt: row.acceptedAt?.toISOString(),
    acceptedByName: row.acceptedByName ?? undefined,
    acceptedByEmail: row.acceptedByEmail ?? undefined,
    discountPct: row.discountPct ?? undefined,
    estimatedCostsCents: row.estimatedCostsCents ?? undefined,
    notes: row.notes ?? undefined,
    parentContractId: row.parentContractId ?? undefined,
    renewalOfTitle: row.renewalOfTitle ?? undefined,
    daysToEnd,
    daysActive,
    margin: computeMargin(row),
  };
}

const BASE_RELATIONS = {
  customer: { columns: { id: true, slug: true, name: true } },
  vehicle: { columns: { id: true, externalId: true, plate: true, model: true } },
  owner: true,
  createdByUser: true,
} as const;

export async function listContracts(workspaceId: string): Promise<Contract[]> {
  const db = getDb();
  const rows = await db.query.contracts.findMany({
    where: eq(s.contracts.workspaceId, workspaceId),
    orderBy: [desc(s.contracts.createdAt)],
    with: BASE_RELATIONS as any,
  });
  return rows.map(toContract);
}

export async function listContractsDetailed(workspaceId: string): Promise<Contract[]> {
  return listContracts(workspaceId);
}

export async function getContract(
  workspaceId: string,
  externalId: string
): Promise<Contract | null> {
  const db = getDb();
  const row = await db.query.contracts.findFirst({
    where: and(
      eq(s.contracts.workspaceId, workspaceId),
      eq(s.contracts.externalId, externalId)
    ),
    with: BASE_RELATIONS as any,
  });
  return row ? toContract(row) : null;
}

export async function getContractFullByExternalId(
  workspaceId: string,
  externalId: string
): Promise<Contract | null> {
  const db = getDb();
  const row: any = await db.query.contracts.findFirst({
    where: and(
      eq(s.contracts.workspaceId, workspaceId),
      eq(s.contracts.externalId, externalId)
    ),
    with: {
      ...BASE_RELATIONS,
      revisions: {
        orderBy: [desc(s.contractRevisions.snapshotAt)],
        with: { snapshotBy: true },
        limit: 30,
      },
      signatures: { orderBy: [desc(s.contractSignatures.signedAt)] },
    } as any,
  });
  if (!row) return null;
  const base = toContract(row);

  const revisions: ContractRevision[] = (row.revisions ?? []).map((r: any) => ({
    id: r.id,
    snapshotAt: r.snapshotAt.toISOString(),
    snapshotBy: toUser(r.snapshotBy),
    title: r.title,
    valueCents: r.valueCents ?? undefined,
    note: r.note ?? undefined,
    body: r.body ?? [],
  }));
  const signatures: ContractSignatureRecord[] = (row.signatures ?? []).map((sig: any) => ({
    id: sig.id,
    signerName: sig.signerName,
    signerEmail: sig.signerEmail ?? undefined,
    signerRole: sig.signerRole ?? undefined,
    signedAt: sig.signedAt.toISOString(),
  }));

  return { ...base, revisions, signatures };
}

export async function smartContractCounts(workspaceId: string, currentUserId?: string) {
  const db = getDb();
  const all = await db.query.contracts.findMany({
    where: eq(s.contracts.workspaceId, workspaceId),
    columns: {
      id: true,
      status: true,
      ownerId: true,
      endsAt: true,
      startsAt: true,
      valueCents: true,
    },
  });
  const now = Date.now();
  let aktiv = 0,
    auslaufend = 0,
    entwurf = 0,
    storniert = 0,
    vorlagen = 0,
    mine = 0,
    expiring30 = 0,
    expiring14 = 0,
    highValue = 0;
  let pipelineCents = 0;
  for (const c of all) {
    if (c.status === 'aktiv') aktiv += 1;
    if (c.status === 'auslaufend') auslaufend += 1;
    if (c.status === 'entwurf') entwurf += 1;
    if (c.status === 'storniert') storniert += 1;
    if (c.status === 'vorlage') vorlagen += 1;
    if (currentUserId && c.ownerId === currentUserId) mine += 1;
    if (c.endsAt && (c.status === 'aktiv' || c.status === 'auslaufend')) {
      const left = Math.ceil((c.endsAt.getTime() - now) / DAY_MS);
      if (left >= 0 && left <= 30) expiring30 += 1;
      if (left >= 0 && left <= 14) expiring14 += 1;
    }
    if ((c.valueCents ?? 0) >= 500_000) highValue += 1;
    if (c.status === 'entwurf') pipelineCents += (c.valueCents ?? 0) * 0.5;
  }
  return {
    all: all.length,
    aktiv,
    auslaufend,
    entwurf,
    storniert,
    vorlagen,
    mine,
    expiring30,
    expiring14,
    highValue,
    pipelineCents,
  };
}

export async function getRenewalCandidates(
  workspaceId: string,
  withinDays = 30
): Promise<Contract[]> {
  const db = getDb();
  const now = new Date();
  const horizon = new Date(now.getTime() + withinDays * DAY_MS);
  const rows = await db.query.contracts.findMany({
    where: and(
      eq(s.contracts.workspaceId, workspaceId),
      gte(s.contracts.endsAt, now),
      lte(s.contracts.endsAt, horizon),
      sql`${s.contracts.status} IN ('aktiv','auslaufend')`
    ),
    orderBy: [asc(s.contracts.endsAt)],
    with: BASE_RELATIONS as any,
  });
  return rows.map(toContract);
}

export async function getRevenueStack(
  workspaceId: string
): Promise<ContractRevenueBucket[]> {
  const db = getDb();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const rows = await db.query.contracts.findMany({
    where: eq(s.contracts.workspaceId, workspaceId),
    columns: { status: true, startsAt: true, endsAt: true, valueCents: true },
  });

  const buckets: ContractRevenueBucket[] = [];
  for (let i = -11; i <= 0; i++) {
    const m = new Date(now.getFullYear(), now.getMonth() + i, 1);
    buckets.push({
      label: m.toLocaleString('de-DE', { month: 'short' }),
      monthIso: m.toISOString().slice(0, 7),
      active: 0,
      expiring: 0,
      pipeline: 0,
    });
  }

  const monthIndex = (d: Date) =>
    (d.getFullYear() - start.getFullYear()) * 12 + (d.getMonth() - start.getMonth());

  for (const c of rows) {
    const value = c.valueCents ?? 0;
    if (value === 0 && c.status !== 'entwurf') continue;
    const monthsSpan =
      c.startsAt && c.endsAt
        ? Math.max(
            1,
            (c.endsAt.getFullYear() - c.startsAt.getFullYear()) * 12 +
              (c.endsAt.getMonth() - c.startsAt.getMonth()) +
              1
          )
        : 1;
    const perMonth = Math.round(value / monthsSpan);
    if (c.status === 'aktiv' && c.startsAt && c.endsAt) {
      const startIdx = Math.max(0, monthIndex(c.startsAt));
      const endIdx = Math.min(11, monthIndex(c.endsAt));
      for (let i = startIdx; i <= endIdx; i++) {
        if (buckets[i]) buckets[i].active += perMonth;
      }
    } else if (c.status === 'auslaufend' && c.endsAt) {
      const endIdx = monthIndex(c.endsAt);
      if (endIdx >= 0 && endIdx <= 11 && buckets[endIdx]) {
        buckets[endIdx].expiring += value;
      }
    } else if (c.status === 'entwurf') {
      const idx = 11;
      if (buckets[idx]) buckets[idx].pipeline += Math.round(value * 0.5);
    }
  }
  return buckets;
}
