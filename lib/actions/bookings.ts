'use server';

import { and, eq, asc } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { checkRateLimit } from '@/lib/auth/rate-limit';

type Result = { ok: true; id: string } | { ok: false; error: string };

function emailValid(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40) || 'kunde'
  );
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? 'k') + (parts[1]?.[0] ?? '')).toUpperCase().slice(0, 4);
}

/**
 * Public booking submission — does NOT require auth. Validates the workspace
 * is publicly bookable (public + business scope), then:
 *  1. Upserts a 'lead' customer (by email)
 *  2. Spawns a calendar event of kind 'meeting' at the requested time
 *  3. Spawns a todo in the workspace's first todo group, assigned to owner
 *  4. Writes a notification to the owner
 *
 * Rate-limited per IP to deter spam.
 */
export async function submitBookingRequest(input: {
  workspaceSlug: string;
  name: string;
  email: string;
  phone?: string;
  preferredAt?: string; // ISO datetime or empty
  message: string;
  ip?: string;
}): Promise<Result> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = (input.phone ?? '').trim();
  const message = input.message.trim();
  if (!name) return { ok: false, error: 'Name fehlt.' };
  if (!emailValid(email)) return { ok: false, error: 'Bitte gültige Email angeben.' };
  if (message.length < 3) return { ok: false, error: 'Bitte eine kurze Nachricht hinterlassen.' };

  const rl = await checkRateLimit('booking', `ip:${input.ip ?? 'unknown'}:${input.workspaceSlug}`);
  if (!rl.ok) {
    return {
      ok: false,
      error: `Zu viele Anfragen. Bitte warte ${rl.retryAfterSec}s.`,
    };
  }

  const db = getDb();
  const ws = await db.query.workspaces.findFirst({
    where: eq(s.workspaces.slug, input.workspaceSlug),
  });
  if (!ws) return { ok: false, error: 'Workspace nicht gefunden.' };
  if (!ws.isPublic) return { ok: false, error: 'Dieser Workspace nimmt keine Buchungen entgegen.' };
  if (ws.scope === 'private') return { ok: false, error: 'Dieser Workspace ist privat.' };
  if (ws.archivedAt) return { ok: false, error: 'Workspace ist archiviert.' };

  // 1. Customer upsert — first try to match an existing contact by email
  let customer: typeof s.customers.$inferSelect | undefined;
  const existingContact = await db.query.customerContacts.findFirst({
    where: eq(s.customerContacts.email, email),
    with: { customer: true },
  });
  if (existingContact?.customer && existingContact.customer.workspaceId === ws.id) {
    customer = existingContact.customer;
  }

  if (!customer) {
    const baseSlug = slugify(name);
    let slug = baseSlug;
    for (let i = 0; i < 6; i++) {
      const dup = await db.query.customers.findFirst({
        where: and(eq(s.customers.workspaceId, ws.id), eq(s.customers.slug, slug)),
      });
      if (!dup) break;
      slug = `${baseSlug}-${Math.floor(Math.random() * 9999)}`;
    }
    const [row] = await db
      .insert(s.customers)
      .values({
        workspaceId: ws.id,
        slug,
        name,
        status: 'lead',
        initials: initialsOf(name),
        fromColor: '#5eb6ff',
        toColor: '#0369a1',
        notes: `Anfrage über Public-Booking · ${new Date().toLocaleDateString('de-DE')}`,
        ownerId: ws.ownerId,
      })
      .returning();
    customer = row;
    await db.insert(s.customerContacts).values({
      customerId: customer.id,
      name,
      email,
      phone: phone || null,
      role: null,
    });
  }

  // 2. Calendar event — preferredAt if parseable, else +24h placeholder
  let startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (input.preferredAt) {
    const parsed = new Date(input.preferredAt);
    if (!isNaN(parsed.getTime()) && parsed.getTime() > Date.now()) {
      startsAt = parsed;
    }
  }
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
  await db.insert(s.calendarEvents).values({
    workspaceId: ws.id,
    kind: 'meeting',
    title: `Anfrage von ${name}`,
    detail: message,
    startsAt,
    endsAt,
    linkedCustomerId: customer.id,
  } as any);

  // 3. Todo — in the first todo group of the workspace
  const firstGroup = await db.query.todoGroups.findFirst({
    where: eq(s.todoGroups.workspaceId, ws.id),
    orderBy: [asc(s.todoGroups.position)],
  });
  if (firstGroup) {
    await db.insert(s.todos).values({
      workspaceId: ws.id,
      groupId: firstGroup.id,
      title: `Buchungs-Anfrage: ${name}`,
      description: message,
      priority: 'hoch',
      status: 'offen',
      dueAt: startsAt,
      assigneeId: ws.ownerId,
      customerId: customer.id,
      createdById: ws.ownerId,
    } as any);
  }

  // 4. Notification (best-effort)
  try {
    await db.insert(s.notifications).values({
      userId: ws.ownerId,
      workspaceId: ws.id,
      kind: 'mention',
      title: `Buchungs-Anfrage: ${name}`,
      excerpt: message.slice(0, 200),
      sourceUrl: `/kunden/${customer.id}`,
    } as any);
  } catch {
    // notifications schema may differ — best-effort only
  }

  return { ok: true, id: customer.id };
}
