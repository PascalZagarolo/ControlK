'use server';

import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import type {
  VehicleDamageSeverity,
  VehicleKind,
  VehicleMaintenanceKind,
  VehicleStatus,
} from '@/lib/types';

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

function paths(externalId?: string) {
  revalidatePath('/flotte');
  if (externalId) revalidatePath(`/flotte/${externalId}`);
}

async function findGuarded(workspaceId: string, vehicleId: string) {
  const db = getDb();
  return db.query.vehicles.findFirst({
    where: and(eq(s.vehicles.id, vehicleId), eq(s.vehicles.workspaceId, workspaceId)),
  });
}

function slugifySimple(v: string): string {
  return v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

// ─── Create / Update ──────────────────────────────────────────
export async function createVehicle(formData: FormData): Promise<Result<{ id: string }>> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();

  const plate = String(formData.get('plate') ?? '').trim();
  const model = String(formData.get('model') ?? '').trim();
  const kind = String(formData.get('kind') ?? 'transporter') as VehicleKind;
  const status = String(formData.get('status') ?? 'frei') as VehicleStatus;
  const location = String(formData.get('location') ?? '').trim();
  const km = parseInt(String(formData.get('km') ?? '0').replace(/[^\d]/g, ''), 10) || 0;
  const nextService = String(formData.get('nextService') ?? '').trim();

  if (!plate) return { ok: false, error: 'Kennzeichen erforderlich.' };
  if (!model) return { ok: false, error: 'Modell erforderlich.' };

  const externalId = `v-${plate.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;

  await db.insert(s.vehicles).values({
    workspaceId: ws.id,
    externalId,
    plate,
    model,
    kind,
    status,
    location: location || null,
    km,
    nextService: nextService || null,
  });

  paths();
  return { ok: true, id: externalId };
}

type EditableField =
  | 'plate'
  | 'model'
  | 'kind'
  | 'status'
  | 'location'
  | 'km'
  | 'nextService'
  | 'lastInspection'
  | 'notes'
  | 'dailyRateCents'
  | 'weekendSurchargeCents'
  | 'acquisitionCents'
  | 'monthlyFixedCostsCents'
  | 'serviceIntervalKm'
  | 'serviceIntervalDays'
  | 'lastServiceKm';

export async function updateVehicleField(input: {
  vehicleId: string;
  field: EditableField;
  value: string;
}): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findGuarded(ws.id, input.vehicleId);
  if (!row) return { ok: false, error: 'Fahrzeug nicht gefunden.' };

  const update: Record<string, any> = {};
  const value = input.value.trim();

  if (input.field === 'plate' || input.field === 'model') {
    if (!value) return { ok: false, error: 'Wert erforderlich.' };
    update[input.field] = value;
  } else if (input.field === 'kind') {
    if (!['sprinter', 'transporter', 'pkw', 'kuehlfahrzeug'].includes(value))
      return { ok: false, error: 'Ungültige Art.' };
    update.kind = value;
  } else if (input.field === 'status') {
    if (!['frei', 'vermietet', 'wartung', 'reserviert'].includes(value))
      return { ok: false, error: 'Ungültiger Status.' };
    update.status = value;
  } else if (input.field === 'location' || input.field === 'notes') {
    update[input.field] = value || null;
  } else if (input.field === 'nextService' || input.field === 'lastInspection') {
    update[input.field] = value || null;
  } else if (
    input.field === 'km' ||
    input.field === 'dailyRateCents' ||
    input.field === 'weekendSurchargeCents' ||
    input.field === 'acquisitionCents' ||
    input.field === 'monthlyFixedCostsCents' ||
    input.field === 'serviceIntervalKm' ||
    input.field === 'serviceIntervalDays' ||
    input.field === 'lastServiceKm'
  ) {
    const n = parseInt(value.replace(/[^\d]/g, ''), 10);
    update[input.field] = Number.isFinite(n) ? n : null;
  }

  await db.update(s.vehicles).set(update).where(eq(s.vehicles.id, input.vehicleId));
  paths(row.externalId ?? undefined);
  return { ok: true };
}

export async function setVehicleOwner(input: {
  vehicleId: string;
  ownerId: string | null;
}): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findGuarded(ws.id, input.vehicleId);
  if (!row) return { ok: false, error: 'Fahrzeug nicht gefunden.' };
  await db.update(s.vehicles).set({ ownerId: input.ownerId }).where(eq(s.vehicles.id, input.vehicleId));
  paths(row.externalId ?? undefined);
  return { ok: true };
}

// ─── Tags ────────────────────────────────────────────────────
export async function createVehicleTag(input: {
  name: string;
  color?: string;
}): Promise<Result<{ id: string }>> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'Name erforderlich.' };
  let slug = slugifySimple(name) || 'tag';
  let i = 1;
  while (true) {
    const dup = await db.query.vehicleTags.findFirst({
      where: and(eq(s.vehicleTags.workspaceId, ws.id), eq(s.vehicleTags.slug, slug)),
    });
    if (!dup) break;
    i += 1;
    slug = `${slugifySimple(name) || 'tag'}-${i}`;
  }
  const [tag] = await db
    .insert(s.vehicleTags)
    .values({ workspaceId: ws.id, slug, name, color: input.color ?? null })
    .returning();
  paths();
  return { ok: true, id: tag.id };
}

export async function deleteVehicleTag(tagId: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const tag = await db.query.vehicleTags.findFirst({
    where: and(eq(s.vehicleTags.id, tagId), eq(s.vehicleTags.workspaceId, ws.id)),
  });
  if (!tag) return { ok: false, error: 'Tag nicht gefunden.' };
  await db.delete(s.vehicleTags).where(eq(s.vehicleTags.id, tagId));
  paths();
  return { ok: true };
}

export async function setVehicleTags(input: {
  vehicleId: string;
  tagIds: string[];
}): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findGuarded(ws.id, input.vehicleId);
  if (!row) return { ok: false, error: 'Fahrzeug nicht gefunden.' };
  await db.delete(s.vehiclesToTags).where(eq(s.vehiclesToTags.vehicleId, input.vehicleId));
  if (input.tagIds.length) {
    await db.insert(s.vehiclesToTags).values(
      input.tagIds.map((tid) => ({ vehicleId: input.vehicleId, tagId: tid }))
    );
  }
  paths(row.externalId ?? undefined);
  return { ok: true };
}

// ─── Damages ─────────────────────────────────────────────────
export async function addVehicleDamage(input: {
  vehicleId: string;
  title: string;
  severity?: VehicleDamageSeverity;
  description?: string;
  costCents?: number;
  customerId?: string | null;
  contractId?: string | null;
  photoUrl?: string;
  occurredAt?: string;
}): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findGuarded(ws.id, input.vehicleId);
  if (!row) return { ok: false, error: 'Fahrzeug nicht gefunden.' };
  const title = input.title.trim();
  if (!title) return { ok: false, error: 'Titel erforderlich.' };
  const [dmg] = await db
    .insert(s.vehicleDamages)
    .values({
      workspaceId: ws.id,
      vehicleId: input.vehicleId,
      customerId: input.customerId || null,
      contractId: input.contractId || null,
      severity: input.severity ?? 'minor',
      title,
      description: input.description?.trim() || null,
      costCents: input.costCents ?? null,
      photoUrl: input.photoUrl?.trim() || null,
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
      createdById: user.id,
    })
    .returning();
  paths(row.externalId ?? undefined);
  return { ok: true, id: dmg.id };
}

export async function deleteVehicleDamage(damageId: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const dmg = await db.query.vehicleDamages.findFirst({
    where: and(
      eq(s.vehicleDamages.id, damageId),
      eq(s.vehicleDamages.workspaceId, ws.id)
    ),
  });
  if (!dmg) return { ok: false, error: 'Schaden nicht gefunden.' };
  const veh = await db.query.vehicles.findFirst({
    where: eq(s.vehicles.id, dmg.vehicleId),
    columns: { externalId: true },
  });
  await db.delete(s.vehicleDamages).where(eq(s.vehicleDamages.id, damageId));
  paths(veh?.externalId ?? undefined);
  return { ok: true };
}

export async function toggleDamageResolved(damageId: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const dmg = await db.query.vehicleDamages.findFirst({
    where: and(eq(s.vehicleDamages.id, damageId), eq(s.vehicleDamages.workspaceId, ws.id)),
  });
  if (!dmg) return { ok: false, error: 'Schaden nicht gefunden.' };
  await db
    .update(s.vehicleDamages)
    .set({ resolved: dmg.resolved === 1 ? 0 : 1 })
    .where(eq(s.vehicleDamages.id, damageId));
  paths();
  return { ok: true };
}

// ─── Maintenance ─────────────────────────────────────────────
export async function addMaintenance(input: {
  vehicleId: string;
  title: string;
  kind?: VehicleMaintenanceKind;
  intervalKm?: number;
  intervalDays?: number;
  lastDoneKm?: number;
  lastDoneAt?: string;
  notes?: string;
}): Promise<Result<{ id: string }>> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findGuarded(ws.id, input.vehicleId);
  if (!row) return { ok: false, error: 'Fahrzeug nicht gefunden.' };
  const title = input.title.trim();
  if (!title) return { ok: false, error: 'Titel erforderlich.' };

  let nextDueAt: Date | null = null;
  if (input.intervalDays && input.lastDoneAt) {
    nextDueAt = new Date(
      new Date(input.lastDoneAt).getTime() + input.intervalDays * 86_400_000
    );
  }

  const [m] = await db
    .insert(s.vehicleMaintenance)
    .values({
      workspaceId: ws.id,
      vehicleId: input.vehicleId,
      kind: input.kind ?? 'service',
      title,
      intervalKm: input.intervalKm ?? null,
      intervalDays: input.intervalDays ?? null,
      lastDoneKm: input.lastDoneKm ?? null,
      lastDoneAt: input.lastDoneAt ? new Date(input.lastDoneAt) : null,
      nextDueAt,
      notes: input.notes?.trim() || null,
    })
    .returning();
  paths(row.externalId ?? undefined);
  return { ok: true, id: m.id };
}

export async function markMaintenanceDone(input: {
  maintenanceId: string;
  doneKm: number;
}): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const m = await db.query.vehicleMaintenance.findFirst({
    where: and(
      eq(s.vehicleMaintenance.id, input.maintenanceId),
      eq(s.vehicleMaintenance.workspaceId, ws.id)
    ),
  });
  if (!m) return { ok: false, error: 'Wartung nicht gefunden.' };
  const now = new Date();
  const nextDue =
    m.intervalDays != null
      ? new Date(now.getTime() + m.intervalDays * 86_400_000)
      : null;
  await db
    .update(s.vehicleMaintenance)
    .set({
      lastDoneAt: now,
      lastDoneKm: input.doneKm,
      nextDueAt: nextDue,
    })
    .where(eq(s.vehicleMaintenance.id, input.maintenanceId));
  // Update vehicle's lastServiceKm and lastServiceAt as proxy
  await db
    .update(s.vehicles)
    .set({ lastServiceAt: now, lastServiceKm: input.doneKm })
    .where(eq(s.vehicles.id, m.vehicleId));
  paths();
  return { ok: true };
}

export async function deleteMaintenance(maintenanceId: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const m = await db.query.vehicleMaintenance.findFirst({
    where: and(
      eq(s.vehicleMaintenance.id, maintenanceId),
      eq(s.vehicleMaintenance.workspaceId, ws.id)
    ),
  });
  if (!m) return { ok: false, error: 'Wartung nicht gefunden.' };
  await db.delete(s.vehicleMaintenance).where(eq(s.vehicleMaintenance.id, maintenanceId));
  paths();
  return { ok: true };
}

// ─── Bulk ───────────────────────────────────────────────────
export async function bulkUpdateVehicles(input: {
  vehicleIds: string[];
  status?: VehicleStatus;
  ownerId?: string | null;
  addTagIds?: string[];
  removeTagIds?: string[];
}): Promise<Result<{ updated: number }>> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  if (input.vehicleIds.length === 0) return { ok: true, updated: 0 };

  const valid = await db
    .select({ id: s.vehicles.id })
    .from(s.vehicles)
    .where(and(eq(s.vehicles.workspaceId, ws.id), inArray(s.vehicles.id, input.vehicleIds)));
  const validIds = valid.map((v) => v.id);
  if (validIds.length === 0) return { ok: false, error: 'Keine gültigen Fahrzeuge.' };

  const update: Record<string, any> = {};
  if (input.status) update.status = input.status;
  if (input.ownerId !== undefined) update.ownerId = input.ownerId;
  if (Object.keys(update).length > 0) {
    await db.update(s.vehicles).set(update).where(inArray(s.vehicles.id, validIds));
  }
  if (input.addTagIds?.length) {
    const pairs = validIds.flatMap((vid) =>
      input.addTagIds!.map((tid) => ({ vehicleId: vid, tagId: tid }))
    );
    await db.insert(s.vehiclesToTags).values(pairs).onConflictDoNothing();
  }
  if (input.removeTagIds?.length) {
    await db
      .delete(s.vehiclesToTags)
      .where(
        and(
          inArray(s.vehiclesToTags.vehicleId, validIds),
          inArray(s.vehiclesToTags.tagId, input.removeTagIds)
        )
      );
  }
  paths();
  return { ok: true, updated: validIds.length };
}

// ─── CSV Import ──────────────────────────────────────────────
export async function importVehiclesCsv(csv: string): Promise<Result<{ imported: number }>> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return { ok: false, error: 'Mindestens eine Datenzeile nötig.' };
  const header = lines[0].split(/[,;]/).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const iPlate = idx('plate') >= 0 ? idx('plate') : idx('kennzeichen');
  const iModel = idx('model') >= 0 ? idx('model') : idx('modell');
  const iKind = idx('kind') >= 0 ? idx('kind') : idx('art');
  const iKm = idx('km');
  if (iPlate < 0 || iModel < 0) {
    return { ok: false, error: 'Spalten "plate" und "model" erforderlich.' };
  }
  let imported = 0;
  for (const line of lines.slice(1)) {
    const cells = line.split(/[,;]/).map((c) => c.trim());
    const plate = cells[iPlate];
    const model = cells[iModel];
    if (!plate || !model) continue;
    const kind = (iKind >= 0 && cells[iKind]) || 'transporter';
    const validKind: VehicleKind = ['sprinter', 'transporter', 'pkw', 'kuehlfahrzeug'].includes(kind)
      ? (kind as VehicleKind)
      : 'transporter';
    const km = iKm >= 0 ? parseInt((cells[iKm] || '').replace(/[^\d]/g, ''), 10) || 0 : 0;
    const externalId = `v-${plate.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}-${imported}`;
    await db.insert(s.vehicles).values({
      workspaceId: ws.id,
      externalId,
      plate,
      model,
      kind: validKind,
      status: 'frei',
      km,
    });
    imported += 1;
  }
  paths();
  return { ok: true, imported };
}

// ─── Share Links ─────────────────────────────────────────────
export async function createVehicleShareLink(input: {
  vehicleId?: string | null;
  expiresInDays?: number | null;
}): Promise<Result<{ token: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  if (input.vehicleId) {
    const v = await findGuarded(ws.id, input.vehicleId);
    if (!v) return { ok: false, error: 'Fahrzeug nicht gefunden.' };
  }
  const token = randomBytes(24).toString('hex');
  const expiresAt =
    input.expiresInDays && input.expiresInDays > 0
      ? new Date(Date.now() + input.expiresInDays * 86_400_000)
      : null;
  await db.insert(s.vehicleShareLinks).values({
    workspaceId: ws.id,
    vehicleId: input.vehicleId ?? null,
    token,
    expiresAt,
    createdById: user.id,
  });
  paths();
  return { ok: true, token };
}

export async function revokeVehicleShareLink(linkId: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await db.query.vehicleShareLinks.findFirst({
    where: and(
      eq(s.vehicleShareLinks.id, linkId),
      eq(s.vehicleShareLinks.workspaceId, ws.id)
    ),
  });
  if (!row) return { ok: false, error: 'Link nicht gefunden.' };
  await db.delete(s.vehicleShareLinks).where(eq(s.vehicleShareLinks.id, linkId));
  paths();
  return { ok: true };
}
