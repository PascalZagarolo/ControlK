'use server';

import { revalidatePath } from 'next/cache';
import { randomBytes, randomUUID } from 'crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { detectConflictForCandidate } from '@/lib/db/queries/calendar';
import type { CalendarEventKind } from '@/lib/types';

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

function paths() {
  revalidatePath('/kalender');
}

async function findGuarded(workspaceId: string, eventId: string) {
  const db = getDb();
  return db.query.calendarEvents.findFirst({
    where: and(
      eq(s.calendarEvents.id, eventId),
      eq(s.calendarEvents.workspaceId, workspaceId)
    ),
  });
}

// ─── Create (with conflict-check) ─────────────────────────────
export async function createCalendarEvent(input: {
  title: string;
  kind?: CalendarEventKind;
  startsAtIso: string;
  durationMinutes?: number;
  endsAtIso?: string;
  detail?: string;
  location?: string;
  linkedCustomerId?: string | null;
  linkedContractId?: string | null;
  linkedVehicleId?: string | null;
  checklist?: { label: string }[];
  reminderMinutes?: number | null;
  allowConflict?: boolean;
  recurringGroupId?: string;
  autoSpawnSource?: string;
}): Promise<Result<{ id: string; conflict?: { id: string; title: string }[] }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();

  const title = input.title.trim();
  if (!title) return { ok: false, error: 'Titel erforderlich.' };
  const start = new Date(input.startsAtIso);
  if (Number.isNaN(start.getTime())) return { ok: false, error: 'Ungültige Startzeit.' };
  const end = input.endsAtIso
    ? new Date(input.endsAtIso)
    : new Date(start.getTime() + (input.durationMinutes ?? 60) * 60_000);
  if (end <= start) return { ok: false, error: 'Endzeit muss nach Startzeit liegen.' };

  if (input.linkedVehicleId && !input.allowConflict) {
    const conflicts = await detectConflictForCandidate(
      ws.id,
      input.linkedVehicleId,
      start,
      end
    );
    if (conflicts.length > 0) {
      return {
        ok: false,
        error: `Fahrzeug ist im Zeitraum bereits gebucht (${conflicts[0].title}). Mit "allow conflict" trotzdem anlegen.`,
      };
    }
  }

  const checklist = (input.checklist ?? []).map((c) => ({
    id: randomUUID(),
    label: c.label.trim(),
    done: false,
  }));

  const [row] = await db
    .insert(s.calendarEvents)
    .values({
      workspaceId: ws.id,
      kind: input.kind ?? 'internal',
      title,
      detail: input.detail?.trim() || null,
      location: input.location?.trim() || null,
      startsAt: start,
      endsAt: end,
      linkedCustomerId: input.linkedCustomerId ?? null,
      linkedContractId: input.linkedContractId ?? null,
      linkedVehicleId: input.linkedVehicleId ?? null,
      checklist,
      reminderMinutes: input.reminderMinutes ?? null,
      recurringGroupId: input.recurringGroupId ?? null,
      autoSpawnSource: input.autoSpawnSource ?? null,
      createdById: user.id,
    })
    .returning();

  paths();
  return { ok: true, id: row.id };
}

export async function createCalendarEventFromForm(
  formData: FormData
): Promise<Result<{ id: string }>> {
  const checklistRaw = String(formData.get('checklist') ?? '');
  const checklist = checklistRaw
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•–—\s]*/, '').trim())
    .filter(Boolean)
    .map((label) => ({ label }));

  return createCalendarEvent({
    title: String(formData.get('title') ?? ''),
    kind: (String(formData.get('kind') ?? 'internal') as CalendarEventKind) || 'internal',
    startsAtIso: String(formData.get('startsAt') ?? ''),
    durationMinutes:
      parseInt(String(formData.get('durationMin') ?? '60').replace(/[^\d]/g, ''), 10) || 60,
    detail: String(formData.get('detail') ?? '') || undefined,
    location: String(formData.get('location') ?? '') || undefined,
    linkedCustomerId: String(formData.get('linkedCustomerId') ?? '') || null,
    linkedContractId: String(formData.get('linkedContractId') ?? '') || null,
    linkedVehicleId: String(formData.get('linkedVehicleId') ?? '') || null,
    checklist,
    reminderMinutes:
      parseInt(String(formData.get('reminderMinutes') ?? '').replace(/[^\d]/g, ''), 10) || null,
    allowConflict: formData.get('allowConflict') === 'on',
  });
}

// ─── Update ───────────────────────────────────────────────────
export async function updateCalendarEvent(input: {
  eventId: string;
  patch: {
    title?: string;
    kind?: CalendarEventKind;
    startsAtIso?: string;
    endsAtIso?: string;
    detail?: string | null;
    location?: string | null;
    linkedCustomerId?: string | null;
    linkedContractId?: string | null;
    linkedVehicleId?: string | null;
    reminderMinutes?: number | null;
  };
  allowConflict?: boolean;
}): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findGuarded(ws.id, input.eventId);
  if (!row) return { ok: false, error: 'Event nicht gefunden.' };

  const update: Record<string, any> = {};
  if (input.patch.title != null) {
    const t = input.patch.title.trim();
    if (!t) return { ok: false, error: 'Titel erforderlich.' };
    update.title = t;
  }
  if (input.patch.kind) update.kind = input.patch.kind;
  if (input.patch.startsAtIso) {
    const d = new Date(input.patch.startsAtIso);
    if (Number.isNaN(d.getTime())) return { ok: false, error: 'Ungültige Startzeit.' };
    update.startsAt = d;
  }
  if (input.patch.endsAtIso) {
    const d = new Date(input.patch.endsAtIso);
    if (Number.isNaN(d.getTime())) return { ok: false, error: 'Ungültige Endzeit.' };
    update.endsAt = d;
  }
  if (input.patch.detail !== undefined) update.detail = input.patch.detail || null;
  if (input.patch.location !== undefined) update.location = input.patch.location || null;
  if (input.patch.linkedCustomerId !== undefined)
    update.linkedCustomerId = input.patch.linkedCustomerId;
  if (input.patch.linkedContractId !== undefined)
    update.linkedContractId = input.patch.linkedContractId;
  if (input.patch.linkedVehicleId !== undefined)
    update.linkedVehicleId = input.patch.linkedVehicleId;
  if (input.patch.reminderMinutes !== undefined)
    update.reminderMinutes = input.patch.reminderMinutes;

  // If vehicle + time changes, re-check conflict
  const vehicleId = update.linkedVehicleId ?? row.linkedVehicleId;
  if (vehicleId && !input.allowConflict && (update.startsAt || update.endsAt || update.linkedVehicleId)) {
    const start = update.startsAt ?? row.startsAt;
    const end = update.endsAt ?? row.endsAt;
    const conflicts = await detectConflictForCandidate(
      ws.id,
      vehicleId,
      start,
      end,
      input.eventId
    );
    if (conflicts.length > 0) {
      return {
        ok: false,
        error: `Konflikt: ${conflicts[0].title} im selben Zeitraum.`,
      };
    }
  }

  await db.update(s.calendarEvents).set(update).where(eq(s.calendarEvents.id, input.eventId));
  paths();
  return { ok: true };
}

// ─── Reschedule (drag-to-move): keep duration, shift start ────
export async function rescheduleEvent(input: {
  eventId: string;
  newStartIso: string;
  allowConflict?: boolean;
}): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findGuarded(ws.id, input.eventId);
  if (!row) return { ok: false, error: 'Event nicht gefunden.' };
  const newStart = new Date(input.newStartIso);
  if (Number.isNaN(newStart.getTime())) return { ok: false, error: 'Ungültige Zeit.' };
  const duration = row.endsAt.getTime() - row.startsAt.getTime();
  const newEnd = new Date(newStart.getTime() + duration);

  if (row.linkedVehicleId && !input.allowConflict) {
    const conflicts = await detectConflictForCandidate(
      ws.id,
      row.linkedVehicleId,
      newStart,
      newEnd,
      input.eventId
    );
    if (conflicts.length > 0) {
      return { ok: false, error: `Konflikt mit ${conflicts[0].title}.` };
    }
  }
  await db
    .update(s.calendarEvents)
    .set({ startsAt: newStart, endsAt: newEnd })
    .where(eq(s.calendarEvents.id, input.eventId));
  paths();
  return { ok: true };
}

// ─── Delete ──────────────────────────────────────────────────
export async function deleteCalendarEvent(eventId: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findGuarded(ws.id, eventId);
  if (!row) return { ok: false, error: 'Event nicht gefunden.' };
  await db.delete(s.calendarEvents).where(eq(s.calendarEvents.id, eventId));
  paths();
  return { ok: true };
}

export async function deleteRecurringSeries(recurringGroupId: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  await db
    .delete(s.calendarEvents)
    .where(
      and(
        eq(s.calendarEvents.workspaceId, ws.id),
        eq(s.calendarEvents.recurringGroupId, recurringGroupId)
      )
    );
  paths();
  return { ok: true };
}

// ─── Mark complete ───────────────────────────────────────────
export async function toggleEventComplete(eventId: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findGuarded(ws.id, eventId);
  if (!row) return { ok: false, error: 'Event nicht gefunden.' };
  const next = row.completedAt ? null : new Date();
  await db.update(s.calendarEvents).set({ completedAt: next }).where(eq(s.calendarEvents.id, eventId));
  paths();
  return { ok: true };
}

// ─── Checklist ───────────────────────────────────────────────
export async function toggleChecklistItem(input: {
  eventId: string;
  itemId: string;
}): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findGuarded(ws.id, input.eventId);
  if (!row) return { ok: false, error: 'Event nicht gefunden.' };
  const list = Array.isArray(row.checklist) ? row.checklist : [];
  const next = list.map((it: any) =>
    it.id === input.itemId ? { ...it, done: !it.done } : it
  );
  await db
    .update(s.calendarEvents)
    .set({ checklist: next })
    .where(eq(s.calendarEvents.id, input.eventId));
  paths();
  return { ok: true };
}

export async function addChecklistItem(input: {
  eventId: string;
  label: string;
}): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findGuarded(ws.id, input.eventId);
  if (!row) return { ok: false, error: 'Event nicht gefunden.' };
  const label = input.label.trim();
  if (!label) return { ok: false, error: 'Label erforderlich.' };
  const list = Array.isArray(row.checklist) ? row.checklist : [];
  const next = [...list, { id: randomUUID(), label, done: false }];
  await db
    .update(s.calendarEvents)
    .set({ checklist: next })
    .where(eq(s.calendarEvents.id, input.eventId));
  paths();
  return { ok: true };
}

export async function removeChecklistItem(input: {
  eventId: string;
  itemId: string;
}): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findGuarded(ws.id, input.eventId);
  if (!row) return { ok: false, error: 'Event nicht gefunden.' };
  const list = Array.isArray(row.checklist) ? row.checklist : [];
  const next = list.filter((it: any) => it.id !== input.itemId);
  await db
    .update(s.calendarEvents)
    .set({ checklist: next })
    .where(eq(s.calendarEvents.id, input.eventId));
  paths();
  return { ok: true };
}

// ─── Recurring (bulk-create) ─────────────────────────────────
export async function createRecurringSeries(input: {
  title: string;
  kind?: CalendarEventKind;
  firstStartIso: string;
  durationMinutes: number;
  rule: 'daily' | 'weekly' | 'monthly' | 'weekdays';
  occurrences: number;
  detail?: string;
  location?: string;
  linkedCustomerId?: string | null;
  linkedContractId?: string | null;
  linkedVehicleId?: string | null;
}): Promise<Result<{ created: number; groupId: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  if (input.occurrences < 1 || input.occurrences > 200)
    return { ok: false, error: 'Anzahl zwischen 1 und 200.' };
  const first = new Date(input.firstStartIso);
  if (Number.isNaN(first.getTime())) return { ok: false, error: 'Ungültige Startzeit.' };
  const groupId = randomUUID();
  const dur = input.durationMinutes * 60_000;
  const values: any[] = [];
  let current = new Date(first);
  let made = 0;
  while (made < input.occurrences) {
    const end = new Date(current.getTime() + dur);
    if (input.rule === 'weekdays') {
      const dow = current.getDay();
      if (dow >= 1 && dow <= 5) {
        values.push({
          workspaceId: ws.id,
          kind: input.kind ?? 'internal',
          title: input.title.trim(),
          detail: input.detail?.trim() || null,
          location: input.location?.trim() || null,
          startsAt: new Date(current),
          endsAt: end,
          linkedCustomerId: input.linkedCustomerId ?? null,
          linkedContractId: input.linkedContractId ?? null,
          linkedVehicleId: input.linkedVehicleId ?? null,
          recurringGroupId: groupId,
          recurringRule: input.rule,
          autoSpawnSource: 'recurring',
          checklist: [],
          createdById: user.id,
        });
        made++;
      }
      current = new Date(current.getTime() + 86_400_000);
      continue;
    }
    values.push({
      workspaceId: ws.id,
      kind: input.kind ?? 'internal',
      title: input.title.trim(),
      detail: input.detail?.trim() || null,
      location: input.location?.trim() || null,
      startsAt: new Date(current),
      endsAt: end,
      linkedCustomerId: input.linkedCustomerId ?? null,
      linkedContractId: input.linkedContractId ?? null,
      linkedVehicleId: input.linkedVehicleId ?? null,
      recurringGroupId: groupId,
      recurringRule: input.rule,
      autoSpawnSource: 'recurring',
      checklist: [],
      createdById: user.id,
    });
    made++;
    if (input.rule === 'daily') current = new Date(current.getTime() + 86_400_000);
    else if (input.rule === 'weekly') current = new Date(current.getTime() + 7 * 86_400_000);
    else if (input.rule === 'monthly') {
      const next = new Date(current);
      next.setMonth(next.getMonth() + 1);
      current = next;
    }
  }
  await db.insert(s.calendarEvents).values(values);
  paths();
  return { ok: true, created: values.length, groupId };
}

// ─── Auto-spawn handover/return from contract ────────────────
export async function autoSpawnEventsForContract(contractId: string): Promise<Result<{ created: number }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const contract = await db.query.contracts.findFirst({
    where: and(
      eq(s.contracts.id, contractId),
      eq(s.contracts.workspaceId, ws.id)
    ),
  });
  if (!contract) return { ok: false, error: 'Vertrag nicht gefunden.' };
  if (!contract.startsAt || !contract.endsAt)
    return { ok: false, error: 'Start- und End-Datum nötig.' };

  // Check if events already exist for this contract
  const existing = await db.query.calendarEvents.findMany({
    where: and(
      eq(s.calendarEvents.workspaceId, ws.id),
      eq(s.calendarEvents.linkedContractId, contractId),
      eq(s.calendarEvents.autoSpawnSource, 'contract')
    ),
  });
  if (existing.length > 0) {
    return { ok: false, error: 'Auto-Events existieren bereits.' };
  }

  const customerId = contract.customerId;
  const customer = customerId
    ? await db.query.customers.findFirst({
        where: eq(s.customers.id, customerId),
        columns: { name: true },
      })
    : null;

  const handoverEnd = new Date(contract.startsAt.getTime() + 30 * 60_000);
  const returnEnd = new Date(contract.endsAt.getTime() + 30 * 60_000);
  const baseChecklist = [
    'Schlüssel-Übergabe',
    'Kilometerstand notieren',
    'Fahrzeugzustand prüfen',
    'Kraftstoffstand notieren',
    'Übergabe-Protokoll',
  ];

  await db.insert(s.calendarEvents).values([
    {
      workspaceId: ws.id,
      kind: 'handover',
      title: customer?.name ? `Übergabe an ${customer.name}` : 'Übergabe',
      detail: `Vertrag: ${contract.title}`,
      startsAt: contract.startsAt,
      endsAt: handoverEnd,
      linkedContractId: contractId,
      linkedCustomerId: customerId,
      autoSpawnSource: 'contract',
      checklist: baseChecklist.map((label) => ({ id: randomUUID(), label, done: false })),
      createdById: user.id,
    },
    {
      workspaceId: ws.id,
      kind: 'return',
      title: customer?.name ? `Rückgabe von ${customer.name}` : 'Rückgabe',
      detail: `Vertrag: ${contract.title}`,
      startsAt: contract.endsAt,
      endsAt: returnEnd,
      linkedContractId: contractId,
      linkedCustomerId: customerId,
      autoSpawnSource: 'contract',
      checklist: baseChecklist.map((label) => ({ id: randomUUID(), label, done: false })),
      createdById: user.id,
    },
  ]);

  paths();
  revalidatePath(`/vertraege/${contractId}`);
  return { ok: true, created: 2 };
}

// ─── Bulk operations ────────────────────────────────────────
export async function bulkDeleteEvents(eventIds: string[]): Promise<Result<{ deleted: number }>> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  if (eventIds.length === 0) return { ok: true, deleted: 0 };
  const valid = await db
    .select({ id: s.calendarEvents.id })
    .from(s.calendarEvents)
    .where(
      and(eq(s.calendarEvents.workspaceId, ws.id), inArray(s.calendarEvents.id, eventIds))
    );
  if (valid.length === 0) return { ok: false, error: 'Keine gültigen Events.' };
  await db.delete(s.calendarEvents).where(inArray(s.calendarEvents.id, valid.map((v) => v.id)));
  paths();
  return { ok: true, deleted: valid.length };
}

// ─── Templates ──────────────────────────────────────────────
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

export async function createEventTemplate(input: {
  name: string;
  kind: CalendarEventKind;
  defaultDurationMinutes: number;
  defaultChecklist: string[];
  description?: string;
}): Promise<Result<{ id: string }>> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'Name erforderlich.' };
  let slug = slugifySimple(name) || 'template';
  let i = 1;
  while (true) {
    const dup = await db.query.calendarEventTemplates.findFirst({
      where: and(
        eq(s.calendarEventTemplates.workspaceId, ws.id),
        eq(s.calendarEventTemplates.slug, slug)
      ),
    });
    if (!dup) break;
    i += 1;
    slug = `${slugifySimple(name) || 'template'}-${i}`;
  }
  const [tpl] = await db
    .insert(s.calendarEventTemplates)
    .values({
      workspaceId: ws.id,
      slug,
      name,
      kind: input.kind,
      defaultDurationMinutes: input.defaultDurationMinutes,
      defaultChecklist: input.defaultChecklist
        .filter((l) => l.trim())
        .map((label) => ({ id: randomUUID(), label: label.trim() })),
      description: input.description?.trim() || null,
    })
    .returning();
  paths();
  return { ok: true, id: tpl.id };
}

export async function deleteEventTemplate(templateId: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const tpl = await db.query.calendarEventTemplates.findFirst({
    where: and(
      eq(s.calendarEventTemplates.id, templateId),
      eq(s.calendarEventTemplates.workspaceId, ws.id)
    ),
  });
  if (!tpl) return { ok: false, error: 'Template nicht gefunden.' };
  await db.delete(s.calendarEventTemplates).where(eq(s.calendarEventTemplates.id, templateId));
  paths();
  return { ok: true };
}

// ─── Share links ────────────────────────────────────────────
export async function createCalendarShareLink(input: {
  customerId?: string | null;
  expiresInDays?: number | null;
}): Promise<Result<{ token: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const token = randomBytes(24).toString('hex');
  const expiresAt =
    input.expiresInDays && input.expiresInDays > 0
      ? new Date(Date.now() + input.expiresInDays * 86_400_000)
      : null;
  await db.insert(s.calendarShareLinks).values({
    workspaceId: ws.id,
    customerId: input.customerId ?? null,
    token,
    expiresAt,
    createdById: user.id,
  });
  paths();
  return { ok: true, token };
}

export async function revokeCalendarShareLink(linkId: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await db.query.calendarShareLinks.findFirst({
    where: and(
      eq(s.calendarShareLinks.id, linkId),
      eq(s.calendarShareLinks.workspaceId, ws.id)
    ),
  });
  if (!row) return { ok: false, error: 'Link nicht gefunden.' };
  await db.delete(s.calendarShareLinks).where(eq(s.calendarShareLinks.id, linkId));
  paths();
  return { ok: true };
}
