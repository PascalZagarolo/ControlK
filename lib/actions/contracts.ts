'use server';

import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { autoSpawnEventsForContract } from './calendar';
import type { ContractStatus } from '@/lib/types';

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

function pathsForContract(externalId?: string) {
  revalidatePath('/vertraege');
  if (externalId) revalidatePath(`/vertraege/${externalId}`);
}

async function findContractGuarded(workspaceId: string, contractId: string) {
  const db = getDb();
  return db.query.contracts.findFirst({
    where: and(eq(s.contracts.id, contractId), eq(s.contracts.workspaceId, workspaceId)),
  });
}

function toCents(v: string): number {
  const clean = v.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  if (!clean) return 0;
  return Math.round(parseFloat(clean) * 100);
}

function externalIdFor(prefix: 'c' | 'tpl', name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 32);
  const stamp = Date.now().toString(36);
  return `${prefix}-${base || 'untitled'}-${stamp}`;
}

export async function createContract(formData: FormData): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();

  const title = String(formData.get('title') ?? '').trim();
  const status = String(formData.get('status') ?? 'entwurf') as
    | 'aktiv'
    | 'auslaufend'
    | 'storniert'
    | 'entwurf'
    | 'vorlage';
  const value = String(formData.get('value') ?? '');
  const customerSlug = String(formData.get('customerSlug') ?? '').trim();
  const startsAt = String(formData.get('startsAt') ?? '');
  const endsAt = String(formData.get('endsAt') ?? '');
  const bodyRaw = String(formData.get('body') ?? '').trim();

  if (!title) return { ok: false, error: 'Titel erforderlich.' };

  let customerId: string | null = null;
  if (customerSlug) {
    const customer = await db.query.customers.findFirst({
      where: and(eq(s.customers.workspaceId, ws.id), eq(s.customers.slug, customerSlug)),
    });
    if (!customer) return { ok: false, error: 'Kunde nicht gefunden.' };
    customerId = customer.id;
  }

  // Body: optional, simple "Heading\nParagraph1\nParagraph2..." pro Section getrennt durch ---
  const body =
    bodyRaw
      .split(/^---$/m)
      .map((section) => section.trim())
      .filter(Boolean)
      .map((section) => {
        const [heading, ...rest] = section.split('\n');
        const paragraphs = rest.join('\n').split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
        return { heading: heading.trim(), paragraphs };
      }) ?? [];

  const externalId = externalIdFor(status === 'vorlage' ? 'tpl' : 'c', title);

  const [inserted] = await db
    .insert(s.contracts)
    .values({
      workspaceId: ws.id,
      externalId,
      customerId,
      title,
      status,
      valueCents: toCents(value),
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
      body,
      createdBy: user.id,
    })
    .returning({ id: s.contracts.id });

  // Auto-Spawn Calendar-Events bei aktivem Vertrag mit Datumsspanne
  if (status === 'aktiv' && startsAt && endsAt && inserted?.id) {
    try {
      await autoSpawnEventsForContract(inserted.id);
    } catch {
      // best-effort
    }
  }

  revalidatePath('/vertraege');
  revalidatePath('/kalender');
  return { ok: true, id: externalId };
}

// ─── Inline-Edit single fields ──────────────────────────────
type EditableField =
  | 'title'
  | 'status'
  | 'value'
  | 'startsAt'
  | 'endsAt'
  | 'discountPct'
  | 'estimatedCostsCents'
  | 'notes';

export async function updateContractField(input: {
  contractId: string;
  field: EditableField;
  value: string;
}): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findContractGuarded(ws.id, input.contractId);
  if (!row) return { ok: false, error: 'Vertrag nicht gefunden.' };

  const update: Record<string, any> = { updatedAt: new Date() };
  const value = input.value.trim();
  if (input.field === 'title') {
    if (!value) return { ok: false, error: 'Titel erforderlich.' };
    update.title = value;
  } else if (input.field === 'status') {
    if (!['aktiv', 'auslaufend', 'storniert', 'entwurf', 'vorlage'].includes(value))
      return { ok: false, error: 'Ungültiger Status.' };
    update.status = value;
  } else if (input.field === 'value') {
    update.valueCents = toCents(value);
  } else if (input.field === 'startsAt' || input.field === 'endsAt') {
    update[input.field] = value ? new Date(value) : null;
  } else if (input.field === 'discountPct') {
    const n = parseInt(value.replace(/[^\d]/g, ''), 10);
    update.discountPct = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
  } else if (input.field === 'estimatedCostsCents') {
    update.estimatedCostsCents = toCents(value);
  } else if (input.field === 'notes') {
    update.notes = value || null;
  }

  await db.update(s.contracts).set(update).where(eq(s.contracts.id, input.contractId));

  // Re-spawn calendar if status changed to 'aktiv' and dates exist
  if (
    input.field === 'status' &&
    value === 'aktiv' &&
    row.startsAt &&
    row.endsAt
  ) {
    try {
      await autoSpawnEventsForContract(input.contractId);
    } catch {}
  }
  pathsForContract(row.externalId ?? undefined);
  return { ok: true };
}

export async function setContractOwner(input: {
  contractId: string;
  ownerId: string | null;
}): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findContractGuarded(ws.id, input.contractId);
  if (!row) return { ok: false, error: 'Vertrag nicht gefunden.' };
  await db
    .update(s.contracts)
    .set({ ownerId: input.ownerId, updatedAt: new Date() })
    .where(eq(s.contracts.id, input.contractId));
  pathsForContract(row.externalId ?? undefined);
  return { ok: true };
}

export async function setContractVehicle(input: {
  contractId: string;
  vehicleId: string | null;
}): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findContractGuarded(ws.id, input.contractId);
  if (!row) return { ok: false, error: 'Vertrag nicht gefunden.' };
  await db
    .update(s.contracts)
    .set({ vehicleId: input.vehicleId, updatedAt: new Date() })
    .where(eq(s.contracts.id, input.contractId));
  pathsForContract(row.externalId ?? undefined);
  return { ok: true };
}

// ─── Body editor (sections) ────────────────────────────────
export async function updateContractBody(input: {
  contractId: string;
  body: { heading: string; paragraphs: string[] }[];
  snapshotNote?: string;
}): Promise<Result> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findContractGuarded(ws.id, input.contractId);
  if (!row) return { ok: false, error: 'Vertrag nicht gefunden.' };

  // Snapshot the OLD body before overwriting
  await db.insert(s.contractRevisions).values({
    contractId: input.contractId,
    body: row.body ?? [],
    title: row.title,
    valueCents: row.valueCents ?? null,
    snapshotById: user.id,
    note: input.snapshotNote?.trim() || null,
  });

  await db
    .update(s.contracts)
    .set({ body: input.body, updatedAt: new Date() })
    .where(eq(s.contracts.id, input.contractId));
  pathsForContract(row.externalId ?? undefined);
  return { ok: true };
}

// ─── Renewal ───────────────────────────────────────────────
export async function renewContract(input: {
  contractId: string;
  newStartsAtIso?: string;
  newEndsAtIso?: string;
  monthsExtension?: number;
}): Promise<Result<{ id: string; newContractId: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findContractGuarded(ws.id, input.contractId);
  if (!row) return { ok: false, error: 'Vertrag nicht gefunden.' };

  // Determine new dates
  let newStart: Date | null = null;
  let newEnd: Date | null = null;
  if (input.newStartsAtIso && input.newEndsAtIso) {
    newStart = new Date(input.newStartsAtIso);
    newEnd = new Date(input.newEndsAtIso);
  } else if (input.monthsExtension && row.endsAt) {
    // Start day after previous ends
    newStart = new Date(row.endsAt.getTime() + 86_400_000);
    newEnd = new Date(newStart);
    newEnd.setMonth(newEnd.getMonth() + input.monthsExtension);
  } else if (row.startsAt && row.endsAt) {
    // Default: same duration as original, starting after original ends
    const dur = row.endsAt.getTime() - row.startsAt.getTime();
    newStart = new Date(row.endsAt.getTime() + 86_400_000);
    newEnd = new Date(newStart.getTime() + dur);
  } else {
    return { ok: false, error: 'Original-Vertrag hat keine Daten zum Verlängern.' };
  }

  const newExternalId = externalIdFor('c', row.title);
  const [inserted] = await db
    .insert(s.contracts)
    .values({
      workspaceId: ws.id,
      externalId: newExternalId,
      customerId: row.customerId,
      vehicleId: row.vehicleId,
      title: `${row.title} · Verlängerung`,
      status: 'aktiv',
      valueCents: row.valueCents,
      startsAt: newStart,
      endsAt: newEnd,
      body: row.body ?? [],
      parentContractId: row.id,
      renewalOfTitle: row.title,
      ownerId: row.ownerId,
      createdBy: user.id,
    })
    .returning({ id: s.contracts.id });

  // Mark old as auslaufend if it was aktiv
  if (row.status === 'aktiv' || row.status === 'auslaufend') {
    await db
      .update(s.contracts)
      .set({ status: 'auslaufend', updatedAt: new Date() })
      .where(eq(s.contracts.id, row.id));
  }

  // Auto-spawn calendar events for the renewal
  if (inserted?.id) {
    try {
      await autoSpawnEventsForContract(inserted.id);
    } catch {}
  }

  revalidatePath('/vertraege');
  revalidatePath('/kalender');
  return { ok: true, id: newExternalId, newContractId: inserted.id };
}

// ─── E-Sign (stub) ─────────────────────────────────────────
export async function signContract(input: {
  contractId: string;
  signerName: string;
  signerEmail?: string;
  signerRole?: string;
  shareToken?: string;
}): Promise<Result> {
  // Note: deliberately permissive — public-share flow can call this without auth.
  // Production E-Sign would integrate DocuSign etc.
  const db = getDb();
  const row = await db.query.contracts.findFirst({
    where: eq(s.contracts.id, input.contractId),
  });
  if (!row) return { ok: false, error: 'Vertrag nicht gefunden.' };
  const name = input.signerName.trim();
  if (!name) return { ok: false, error: 'Name erforderlich.' };

  await db.insert(s.contractSignatures).values({
    contractId: input.contractId,
    signerName: name,
    signerEmail: input.signerEmail?.trim() || null,
    signerRole: input.signerRole?.trim() || null,
    shareToken: input.shareToken ?? null,
  });

  await db
    .update(s.contracts)
    .set({
      acceptedAt: new Date(),
      acceptedByName: name,
      acceptedByEmail: input.signerEmail?.trim() || null,
      status: 'aktiv',
      updatedAt: new Date(),
    })
    .where(eq(s.contracts.id, input.contractId));

  if (row.externalId) revalidatePath(`/vertraege/${row.externalId}`);
  revalidatePath('/vertraege');
  return { ok: true };
}

// ─── Delete ────────────────────────────────────────────────
export async function deleteContract(contractId: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findContractGuarded(ws.id, contractId);
  if (!row) return { ok: false, error: 'Vertrag nicht gefunden.' };
  await db.delete(s.contracts).where(eq(s.contracts.id, contractId));
  pathsForContract();
  return { ok: true };
}

// ─── Bulk ──────────────────────────────────────────────────
export async function bulkUpdateContracts(input: {
  contractIds: string[];
  status?: ContractStatus;
  ownerId?: string | null;
}): Promise<Result<{ updated: number }>> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  if (input.contractIds.length === 0) return { ok: true, updated: 0 };

  const valid = await db
    .select({ id: s.contracts.id })
    .from(s.contracts)
    .where(
      and(eq(s.contracts.workspaceId, ws.id), inArray(s.contracts.id, input.contractIds))
    );
  if (valid.length === 0) return { ok: false, error: 'Keine gültigen Verträge.' };

  const update: Record<string, any> = { updatedAt: new Date() };
  if (input.status) update.status = input.status;
  if (input.ownerId !== undefined) update.ownerId = input.ownerId;
  if (Object.keys(update).length > 1) {
    await db
      .update(s.contracts)
      .set(update)
      .where(inArray(s.contracts.id, valid.map((v) => v.id)));
  }
  pathsForContract();
  return { ok: true, updated: valid.length };
}

// ─── Share Links ───────────────────────────────────────────
export async function createContractShareLink(input: {
  contractId: string;
  allowSignature?: boolean;
  expiresInDays?: number | null;
}): Promise<Result<{ token: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findContractGuarded(ws.id, input.contractId);
  if (!row) return { ok: false, error: 'Vertrag nicht gefunden.' };

  const token = randomBytes(24).toString('hex');
  const expiresAt =
    input.expiresInDays && input.expiresInDays > 0
      ? new Date(Date.now() + input.expiresInDays * 86_400_000)
      : null;

  await db.insert(s.contractShareLinks).values({
    workspaceId: ws.id,
    contractId: input.contractId,
    token,
    allowSignature: input.allowSignature ? 1 : 0,
    expiresAt,
    createdById: user.id,
  });
  pathsForContract(row.externalId ?? undefined);
  return { ok: true, token };
}

export async function revokeContractShareLink(linkId: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await db.query.contractShareLinks.findFirst({
    where: and(
      eq(s.contractShareLinks.id, linkId),
      eq(s.contractShareLinks.workspaceId, ws.id)
    ),
  });
  if (!row) return { ok: false, error: 'Link nicht gefunden.' };
  await db.delete(s.contractShareLinks).where(eq(s.contractShareLinks.id, linkId));
  pathsForContract();
  return { ok: true };
}

// ─── Post into Channel (Quote-in-Channel from contract page) ─
export async function postContractToChannel(input: {
  contractId: string;
  channelId: string;
  body?: string;
}): Promise<Result> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const c = await findContractGuarded(ws.id, input.contractId);
  if (!c) return { ok: false, error: 'Vertrag nicht gefunden.' };
  const ch = await db.query.channels.findFirst({
    where: and(eq(s.channels.id, input.channelId), eq(s.channels.workspaceId, ws.id)),
  });
  if (!ch) return { ok: false, error: 'Channel nicht gefunden.' };
  const body =
    input.body?.trim() ||
    `📎 Vertrag: ${c.title}${c.valueCents ? ` · €${(c.valueCents / 100).toLocaleString('de-DE')}` : ''}\nLink: /vertraege/${c.externalId ?? c.id}`;
  await db.insert(s.messages).values({
    channelId: input.channelId,
    authorId: user.id,
    body,
  });
  revalidatePath(`/channels/${ch.slug}`);
  return { ok: true };
}
