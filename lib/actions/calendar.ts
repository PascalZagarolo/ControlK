'use server';

import { revalidatePath } from 'next/cache';
import { randomBytes, randomUUID } from 'crypto';
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { detectConflictForCandidate } from '@/lib/db/queries/calendar';
import { aiGenerateJSON, aiGatewayConfigured, AI_MODEL_FAST } from '@/lib/ai/gateway';
import { triggerEvent } from '@/lib/realtime/pusher-server';
import type { CalendarEventKind } from '@/lib/types';

const EVENT_KINDS: CalendarEventKind[] = [
  'meeting', 'call', 'focus', 'task', 'personal', 'health', 'travel', 'other',
  'handover', 'return', 'maintenance', 'internal',
];

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

function paths() {
  revalidatePath('/kalender');
}

/**
 * Revalidate + broadcast a live "calendar changed" event to everyone viewing
 * this workspace's calendar (Pusher; no-op if Pusher isn't configured). Use
 * in mutating actions so teammates see changes without a manual reload.
 */
async function bumpCalendar(workspaceId: string) {
  revalidatePath('/kalender');
  await triggerEvent(`private-workspace-${workspaceId}-calendar`, 'calendar.changed', {});
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
  /** Workspace member user-ids to add as attendees. The creator is always added. */
  attendeeIds?: string[];
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

  // Attendees: always include the creator (accepted); add any selected
  // workspace members (invited). Non-members are silently dropped.
  await insertAttendees(ws.id, row.id, user.id, input.attendeeIds ?? [], user.id);

  await bumpCalendar(ws.id);
  return { ok: true, id: row.id };
}

/**
 * Inserts attendees for an event, validating that each user is a member of the
 * workspace. The creator is always added with status 'accepted'; everyone else
 * 'invited'. Idempotent via the (event_id, user_id) unique index.
 */
async function insertAttendees(
  workspaceId: string,
  eventId: string,
  creatorId: string,
  userIds: string[],
  addedById: string
): Promise<void> {
  const db = getDb();
  const wanted = new Set(userIds);
  wanted.add(creatorId);

  // Keep only real workspace members.
  const members = await db.query.workspaceMembers.findMany({
    where: and(
      eq(s.workspaceMembers.workspaceId, workspaceId),
      inArray(s.workspaceMembers.userId, Array.from(wanted))
    ),
    columns: { userId: true },
  });
  const valid = new Set(members.map((m) => m.userId));
  if (valid.size === 0) return;

  await db
    .insert(s.calendarEventAttendees)
    .values(
      Array.from(valid).map((userId) => ({
        eventId,
        userId,
        workspaceId,
        status: (userId === creatorId ? 'accepted' : 'invited') as
          | 'accepted'
          | 'invited',
        addedById,
      }))
    )
    .onConflictDoNothing();
}

// ─── Attendee management ──────────────────────────────────────
export async function addEventAttendee(eventId: string, userId: string): Promise<Result> {
  const me = await requireUser();
  const ws = await requireCurrentWorkspace();
  const event = await findGuarded(ws.id, eventId);
  if (!event) return { ok: false, error: 'Termin nicht gefunden.' };
  const db = getDb();
  const member = await db.query.workspaceMembers.findFirst({
    where: and(eq(s.workspaceMembers.workspaceId, ws.id), eq(s.workspaceMembers.userId, userId)),
    columns: { userId: true },
  });
  if (!member) return { ok: false, error: 'Nutzer ist kein Workspace-Mitglied.' };
  await db
    .insert(s.calendarEventAttendees)
    .values({ eventId, userId, workspaceId: ws.id, status: 'invited', addedById: me.id })
    .onConflictDoNothing();
  await bumpCalendar(ws.id);
  return { ok: true };
}

export async function removeEventAttendee(eventId: string, userId: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const event = await findGuarded(ws.id, eventId);
  if (!event) return { ok: false, error: 'Termin nicht gefunden.' };
  const db = getDb();
  await db
    .delete(s.calendarEventAttendees)
    .where(
      and(
        eq(s.calendarEventAttendees.eventId, eventId),
        eq(s.calendarEventAttendees.userId, userId)
      )
    );
  await bumpCalendar(ws.id);
  return { ok: true };
}

// ─── Natural-language quick-add ───────────────────────────────
export type QuickParsedEvent = {
  title: string;
  kind: CalendarEventKind;
  startsAtIso: string;
  durationMinutes: number;
  location?: string;
  detail?: string;
};

/**
 * Parses a free-text line ("Übergabe morgen 14 Uhr BMW X5 für Müller") into
 * structured event fields via the AI gateway. Returns a draft for the user to
 * confirm in the create modal — never creates the event directly, so an AI
 * misread is always editable first. Falls back to a title-only draft when the
 * gateway isn't configured or parsing fails, so the feature degrades quietly.
 */
export async function parseQuickEvent(
  text: string
): Promise<Result<{ draft: QuickParsedEvent; ai: boolean }>> {
  await requireUser();
  await requireCurrentWorkspace();
  const input = text.trim();
  if (!input) return { ok: false, error: 'Leere Eingabe.' };

  // Deterministic fallback: title-only draft, next full hour, 60 min.
  const fallback = (): QuickParsedEvent => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return { title: input, kind: 'meeting', startsAtIso: d.toISOString(), durationMinutes: 60 };
  };

  if (!aiGatewayConfigured()) {
    return { ok: true, draft: fallback(), ai: false };
  }

  const now = new Date();
  try {
    const parsed = await aiGenerateJSON<{
      title?: string;
      kind?: string;
      startsAtIso?: string;
      durationMinutes?: number;
      location?: string;
      detail?: string;
    }>({
      model: AI_MODEL_FAST,
      maxOutputTokens: 300,
      system:
        'Du extrahierst aus einer deutschen Termin-Eingabe strukturierte Felder. ' +
        'Antworte NUR mit einem JSON-Objekt, keine Erklärung.',
      prompt:
        `Jetzt ist ${now.toISOString()} (${now.toLocaleString('de-DE', { weekday: 'long' })}).\n` +
        `Eingabe: "${input}"\n\n` +
        `Gib JSON mit: title (string, ohne Zeit-/Datumsangaben), ` +
        `kind (einer von: ${EVENT_KINDS.join(', ')}), ` +
        `startsAtIso (ISO 8601 mit Zeitzone, relative Angaben wie "morgen 14 Uhr" auflösen), ` +
        `durationMinutes (number, Standard 60), ` +
        `location (string, optional), detail (string, optional).`,
    });

    if (!parsed || !parsed.startsAtIso) return { ok: true, draft: fallback(), ai: false };
    const start = new Date(parsed.startsAtIso);
    if (Number.isNaN(start.getTime())) return { ok: true, draft: fallback(), ai: false };
    const kind = (EVENT_KINDS.includes(parsed.kind as CalendarEventKind)
      ? parsed.kind
      : 'meeting') as CalendarEventKind;

    return {
      ok: true,
      ai: true,
      draft: {
        title: (parsed.title || input).slice(0, 120),
        kind,
        startsAtIso: start.toISOString(),
        durationMinutes:
          typeof parsed.durationMinutes === 'number' && parsed.durationMinutes > 0
            ? Math.min(parsed.durationMinutes, 1440)
            : 60,
        location: parsed.location?.slice(0, 200) || undefined,
        detail: parsed.detail?.slice(0, 500) || undefined,
      },
    };
  } catch {
    return { ok: true, draft: fallback(), ai: false };
  }
}

// ─── Smart slot finder ────────────────────────────────────────
export type FreeSlot = { startIso: string; endIso: string };

/**
 * Finds open slots of `durationMinutes` within working hours over a date
 * window, avoiding everything the chosen participants are already booked for
 * (as creator or attendee) and — if given — a vehicle's bookings. Works for
 * a solo private user (just "when am I free?") and for teams (overlap of
 * several people). The current user is always part of the participant set.
 */
export async function findFreeSlots(input: {
  durationMinutes: number;
  fromIso: string;
  toIso: string;
  attendeeIds?: string[];
  vehicleId?: string | null;
  workStartHour?: number;
  workEndHour?: number;
}): Promise<Result<{ slots: FreeSlot[] }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();

  const duration = Math.max(5, Math.min(input.durationMinutes || 60, 1440));
  const from = new Date(input.fromIso);
  const to = new Date(input.toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    return { ok: false, error: 'Ungültiger Zeitraum.' };
  }
  const workStart = clampHour(input.workStartHour, 8);
  const workEnd = clampHour(input.workEndHour, 18);
  if (workEnd <= workStart) return { ok: false, error: 'Ungültige Arbeitszeiten.' };

  const participants = new Set<string>([user.id, ...(input.attendeeIds ?? [])]);

  const events = await db.query.calendarEvents.findMany({
    where: and(
      eq(s.calendarEvents.workspaceId, ws.id),
      gte(s.calendarEvents.endsAt, from),
      lte(s.calendarEvents.startsAt, to)
    ),
    columns: { startsAt: true, endsAt: true, createdById: true, linkedVehicleId: true },
    with: { attendees: { columns: { userId: true } } },
  });

  // Busy = any event involving a chosen participant or the chosen vehicle.
  const busy: { start: number; end: number }[] = [];
  for (const e of events as any[]) {
    const involvesParticipant =
      (e.createdById && participants.has(e.createdById)) ||
      (e.attendees ?? []).some((a: any) => participants.has(a.userId));
    const involvesVehicle = input.vehicleId && e.linkedVehicleId === input.vehicleId;
    if (involvesParticipant || involvesVehicle) {
      busy.push({ start: e.startsAt.getTime(), end: e.endsAt.getTime() });
    }
  }
  busy.sort((a, b) => a.start - b.start);

  const now = Date.now();
  const durMs = duration * 60_000;
  const slots: FreeSlot[] = [];
  const MAX = 12;

  const dayCursor = new Date(from);
  dayCursor.setHours(0, 0, 0, 0);
  while (dayCursor <= to && slots.length < MAX) {
    const dayStart = new Date(dayCursor);
    dayStart.setHours(workStart, 0, 0, 0);
    const dayEnd = new Date(dayCursor);
    dayEnd.setHours(workEnd, 0, 0, 0);

    // Busy intervals clipped to this working window.
    const dayBusy = busy
      .map((b) => ({ start: Math.max(b.start, dayStart.getTime()), end: Math.min(b.end, dayEnd.getTime()) }))
      .filter((b) => b.end > b.start)
      .sort((a, b) => a.start - b.start);

    // Walk the free gaps between busy intervals.
    let cursor = Math.max(dayStart.getTime(), now);
    cursor = roundUpTo(cursor, 15);
    const pushFrom = (gapStart: number, gapEnd: number) => {
      let c = roundUpTo(Math.max(gapStart, dayStart.getTime(), now), 15);
      let perGap = 0;
      while (c + durMs <= gapEnd && slots.length < MAX && perGap < 2) {
        slots.push({ startIso: new Date(c).toISOString(), endIso: new Date(c + durMs).toISOString() });
        c += durMs;
        perGap++;
      }
    };
    for (const b of dayBusy) {
      if (b.start > cursor) pushFrom(cursor, b.start);
      cursor = Math.max(cursor, b.end);
      if (slots.length >= MAX) break;
    }
    if (cursor < dayEnd.getTime()) pushFrom(cursor, dayEnd.getTime());

    dayCursor.setDate(dayCursor.getDate() + 1);
  }

  return { ok: true, slots: slots.slice(0, MAX) };
}

function clampHour(h: number | undefined, fallback: number): number {
  if (typeof h !== 'number' || Number.isNaN(h)) return fallback;
  return Math.max(0, Math.min(23, Math.round(h)));
}
function roundUpTo(ms: number, minutes: number): number {
  const step = minutes * 60_000;
  return Math.ceil(ms / step) * step;
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
  await bumpCalendar(ws.id);
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
  await bumpCalendar(ws.id);
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
  await bumpCalendar(ws.id);
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
