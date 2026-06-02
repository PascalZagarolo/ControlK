'use server';

import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { listCustomersMinimal } from '@/lib/db/queries/customers';
import type { CustomerStatus } from '@/lib/types';

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

function paths(slug?: string) {
  revalidatePath('/kunden');
  if (slug) revalidatePath(`/kunden/${slug}`);
}

async function findGuarded(workspaceId: string, customerId: string) {
  const db = getDb();
  return db.query.customers.findFirst({
    where: and(eq(s.customers.id, customerId), eq(s.customers.workspaceId, workspaceId)),
  });
}

function slugify(v: string): string {
  return v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48);
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? 'C') + (parts[1]?.[0] ?? '')).toUpperCase().slice(0, 4);
}

const COLORS: { from: string; to: string }[] = [
  { from: '#ff7a7a', to: '#c81d1d' },
  { from: '#5eb6ff', to: '#0369a1' },
  { from: '#5ee08a', to: '#166534' },
  { from: '#c084fc', to: '#6b21a8' },
  { from: '#ffb45e', to: '#b45309' },
  { from: '#f472b6', to: '#9d174d' },
];

function pickColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

export async function createCustomer(formData: FormData): Promise<Result<{ slug: string }>> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();

  const name = String(formData.get('name') ?? '').trim();
  const industry = String(formData.get('industry') ?? '').trim();
  const status = (String(formData.get('status') ?? 'lead') as 'aktiv' | 'lead' | 'inaktiv');
  const notes = String(formData.get('notes') ?? '').trim();
  if (!name) return { ok: false, error: 'Name erforderlich.' };

  let slug = slugify(name) || `kunde-${Date.now()}`;
  // ensure uniqueness within workspace
  for (let i = 0; i < 8; i++) {
    const dup = await db.query.customers.findFirst({
      where: and(eq(s.customers.workspaceId, ws.id), eq(s.customers.slug, slug)),
    });
    if (!dup) break;
    slug = `${slugify(name)}-${Math.floor(Math.random() * 999)}`;
  }

  const color = pickColor(slug);
  await db.insert(s.customers).values({
    workspaceId: ws.id,
    slug,
    name,
    industry: industry || null,
    status,
    initials: initialsOf(name),
    fromColor: color.from,
    toColor: color.to,
    notes: notes || '',
  });

  revalidatePath('/kunden');
  return { ok: true, slug };
}

// ─── Manuelle Kontakte (telefonisch akquiriert, nur Business-Workspaces) ──
//
// Ein manuell angelegter Kontakt teilt das BESTEHENDE geteilte customers-Modell
// (+ customer_contacts für Mehrfach-Adressen). Die Mail-Rückführung läuft danach
// automatisch über resolveClient (crm_contact) — keine eigene Zuordnungslogik.
// Bewusst NICHT: Pipeline-Stages, Aktivitäts-Logging, Follow-up-Engine, Scoring.

function normEmails(raw: string[] | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of raw ?? []) {
    const e = r.trim().toLowerCase();
    if (!e.includes('@') || seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
}

export async function createManualContact(input: {
  name: string;
  emails?: string[];
  company?: string | null;
  phone?: string | null;
  status?: string | null;
  note?: string | null;
}): Promise<Result<{ slug: string; id: string }>> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  // Business-Gate: das Kontaktmanagement existiert nur in Team/Business-Workspaces.
  if (ws.scope !== 'business') {
    return { ok: false, error: 'Kontakte gibt es nur in Business-Workspaces.' };
  }
  const db = getDb();

  const name = input.name.trim();
  if (!name) return { ok: false, error: 'Name erforderlich.' };
  const emails = normEmails(input.emails);

  const base = slugify(name) || 'kontakt';
  let slug = base;
  for (let i = 0; i < 8; i++) {
    const dup = await db.query.customers.findFirst({
      where: and(eq(s.customers.workspaceId, ws.id), eq(s.customers.slug, slug)),
    });
    if (!dup) break;
    // Last attempt: a timestamp suffix is effectively collision-proof, so the
    // unique index never rejects the insert even for adversarial name clusters.
    slug = i === 7 ? `${base}-${Date.now()}` : `${base}-${Math.floor(Math.random() * 9999)}`;
  }

  const color = pickColor(slug);
  const [row] = await db
    .insert(s.customers)
    .values({
      workspaceId: ws.id,
      slug,
      name,
      source: 'manual',
      company: input.company?.trim() || null,
      phone: input.phone?.trim() || null,
      contactStatus: input.status?.trim() || null,
      initials: initialsOf(name),
      fromColor: color.from,
      toColor: color.to,
      notes: input.note?.trim() || '',
    })
    .returning({ id: s.customers.id });

  if (emails.length > 0) {
    await db.insert(s.customerContacts).values(
      emails.map((email) => ({
        customerId: row.id,
        name,
        email,
      }))
    );
  }

  revalidatePath('/kunden');
  revalidatePath('/inbox');
  revalidatePath('/plan');
  return { ok: true, slug, id: row.id };
}

/** Edit the manual-contact fields (no structured stages — just these). */
export async function updateManualContact(input: {
  customerId: string;
  name?: string;
  company?: string | null;
  phone?: string | null;
  status?: string | null;
  note?: string | null;
}): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  if (ws.scope !== 'business') return { ok: false, error: 'Nur in Business-Workspaces.' };
  const db = getDb();
  const customer = await findGuarded(ws.id, input.customerId);
  if (!customer) return { ok: false, error: 'Kontakt nicht gefunden.' };

  const patch: Record<string, string | null> = {};
  if (input.name !== undefined) {
    const n = input.name.trim();
    if (!n) return { ok: false, error: 'Name darf nicht leer sein.' };
    patch.name = n;
  }
  if (input.company !== undefined) patch.company = input.company?.trim() || null;
  if (input.phone !== undefined) patch.phone = input.phone?.trim() || null;
  if (input.status !== undefined) patch.contactStatus = input.status?.trim() || null;
  if (input.note !== undefined) patch.notes = input.note?.trim() || '';
  if (Object.keys(patch).length === 0) return { ok: true };

  await db.update(s.customers).set(patch).where(eq(s.customers.id, input.customerId));
  paths(customer.slug);
  revalidatePath('/inbox');
  return { ok: true };
}

/** Add an email address to a manual contact (mail then auto-attributes). */
export async function addContactEmail(input: {
  customerId: string;
  email: string;
}): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  // Defense-in-depth: manual contacts only exist in Business-Workspaces.
  if (ws.scope !== 'business') return { ok: false, error: 'Nur in Business-Workspaces.' };
  const db = getDb();
  const email = input.email.trim().toLowerCase();
  if (!email.includes('@')) return { ok: false, error: 'Ungültige E-Mail.' };

  // Don't split a contact's mail across two records: reject an address already
  // assigned to a DIFFERENT contact in this workspace.
  const clash = await db
    .select({ id: s.customerContacts.id })
    .from(s.customerContacts)
    .innerJoin(s.customers, eq(s.customers.id, s.customerContacts.customerId))
    .where(
      and(
        eq(s.customers.workspaceId, ws.id),
        sql`lower(${s.customerContacts.email}) = ${email}`,
        sql`${s.customerContacts.customerId} <> ${input.customerId}`
      )
    )
    .limit(1);
  if (clash.length > 0) {
    return { ok: false, error: 'Diese Adresse ist bereits einem anderen Kontakt zugeordnet.' };
  }

  // Reuse the CRM linker — same customer_contacts table + per-customer dedup.
  return linkSenderToCustomer({ customerId: input.customerId, email });
}

/** Remove an email address from a manual contact. */
export async function removeContactEmail(input: {
  customerId: string;
  contactId: string;
}): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  if (ws.scope !== 'business') return { ok: false, error: 'Nur in Business-Workspaces.' };
  const db = getDb();
  const customer = await findGuarded(ws.id, input.customerId);
  if (!customer) return { ok: false, error: 'Kontakt nicht gefunden.' };
  await db
    .delete(s.customerContacts)
    .where(
      and(
        eq(s.customerContacts.id, input.contactId),
        eq(s.customerContacts.customerId, input.customerId)
      )
    );
  paths(customer.slug);
  revalidatePath('/inbox');
  return { ok: true };
}

// ─── Inline-Edit single fields ──────────────────────────────
type EditableField = 'name' | 'industry' | 'status' | 'notes' | 'forecastContribution';

export async function updateCustomerField(input: {
  customerId: string;
  field: EditableField;
  value: string;
}): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findGuarded(ws.id, input.customerId);
  if (!row) return { ok: false, error: 'Kunde nicht gefunden.' };

  const value = input.value.trim();
  const update: Record<string, any> = {};

  if (input.field === 'name') {
    if (!value) return { ok: false, error: 'Name erforderlich.' };
    update.name = value;
  } else if (input.field === 'industry') {
    update.industry = value || null;
  } else if (input.field === 'status') {
    if (!['aktiv', 'lead', 'inaktiv'].includes(value)) {
      return { ok: false, error: 'Ungültiger Status.' };
    }
    update.status = value as CustomerStatus;
  } else if (input.field === 'notes') {
    update.notes = value;
  } else if (input.field === 'forecastContribution') {
    update.forecastContribution = value || null;
  }

  await db.update(s.customers).set(update).where(eq(s.customers.id, input.customerId));
  paths(row.slug);
  return { ok: true };
}

export async function setCustomerOwner(input: {
  customerId: string;
  ownerId: string | null;
}): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findGuarded(ws.id, input.customerId);
  if (!row) return { ok: false, error: 'Kunde nicht gefunden.' };
  await db
    .update(s.customers)
    .set({ ownerId: input.ownerId })
    .where(eq(s.customers.id, input.customerId));
  paths(row.slug);
  return { ok: true };
}

// ─── Onboarding ─────────────────────────────────────────────
export async function toggleOnboardingStep(input: {
  customerId: string;
  stepKey: string;
}): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findGuarded(ws.id, input.customerId);
  if (!row) return { ok: false, error: 'Kunde nicht gefunden.' };
  const progress = (row as any).onboardingProgress ?? {};
  const next = { ...progress, [input.stepKey]: !progress[input.stepKey] };
  const updates: any = { onboardingProgress: next };
  if (!row.onboardingStartedAt) updates.onboardingStartedAt = new Date();
  await db.update(s.customers).set(updates).where(eq(s.customers.id, input.customerId));
  paths(row.slug);
  return { ok: true };
}

// ─── Tags ──────────────────────────────────────────────────
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

export async function createCustomerTag(input: {
  name: string;
  color?: string;
}): Promise<Result<{ id: string; slug: string }>> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'Name erforderlich.' };
  let slug = slugifySimple(name) || 'tag';
  let i = 1;
  while (true) {
    const dup = await db.query.customerTags.findFirst({
      where: and(eq(s.customerTags.workspaceId, ws.id), eq(s.customerTags.slug, slug)),
    });
    if (!dup) break;
    i += 1;
    slug = `${slugifySimple(name) || 'tag'}-${i}`;
  }
  const [tag] = await db
    .insert(s.customerTags)
    .values({
      workspaceId: ws.id,
      slug,
      name,
      color: input.color ?? null,
    })
    .returning();
  paths();
  return { ok: true, id: tag.id, slug };
}

export async function deleteCustomerTag(tagId: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const tag = await db.query.customerTags.findFirst({
    where: and(eq(s.customerTags.id, tagId), eq(s.customerTags.workspaceId, ws.id)),
  });
  if (!tag) return { ok: false, error: 'Tag nicht gefunden.' };
  await db.delete(s.customerTags).where(eq(s.customerTags.id, tagId));
  paths();
  return { ok: true };
}

export async function setCustomerTags(input: {
  customerId: string;
  tagIds: string[];
}): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findGuarded(ws.id, input.customerId);
  if (!row) return { ok: false, error: 'Kunde nicht gefunden.' };
  await db.delete(s.customersToTags).where(eq(s.customersToTags.customerId, input.customerId));
  if (input.tagIds.length) {
    // Tenancy: only assign tags that belong to THIS workspace. The FK alone
    // would accept a tag id from another workspace; this filter prevents
    // cross-workspace tag linkage.
    const validTagIds = await workspaceTagIds(ws.id, input.tagIds);
    if (validTagIds.length) {
      await db.insert(s.customersToTags).values(
        validTagIds.map((tid) => ({ customerId: input.customerId, tagId: tid }))
      );
    }
  }
  paths(row.slug);
  return { ok: true };
}

/** Filters a tag-id list down to those owned by the given workspace. */
async function workspaceTagIds(workspaceId: string, tagIds: string[]): Promise<string[]> {
  if (tagIds.length === 0) return [];
  const db = getDb();
  const rows = await db
    .select({ id: s.customerTags.id })
    .from(s.customerTags)
    .where(and(eq(s.customerTags.workspaceId, workspaceId), inArray(s.customerTags.id, tagIds)));
  return rows.map((r) => r.id);
}

// ─── Bulk Actions ──────────────────────────────────────────
export async function bulkUpdateCustomers(input: {
  customerIds: string[];
  status?: CustomerStatus;
  ownerId?: string | null;
  addTagIds?: string[];
  removeTagIds?: string[];
}): Promise<Result<{ updated: number }>> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  if (input.customerIds.length === 0) return { ok: true, updated: 0 };

  // Verify all belong to workspace
  const valid = await db
    .select({ id: s.customers.id })
    .from(s.customers)
    .where(
      and(eq(s.customers.workspaceId, ws.id), inArray(s.customers.id, input.customerIds))
    );
  const validIds = valid.map((v) => v.id);
  if (validIds.length === 0) return { ok: false, error: 'Keine gültigen Kunden.' };

  const update: Record<string, any> = {};
  if (input.status) update.status = input.status;
  if (input.ownerId !== undefined) update.ownerId = input.ownerId;
  if (Object.keys(update).length > 0) {
    await db.update(s.customers).set(update).where(inArray(s.customers.id, validIds));
  }
  if (input.addTagIds?.length) {
    // Tenancy: restrict to tags owned by this workspace before linking.
    const validTagIds = await workspaceTagIds(ws.id, input.addTagIds);
    if (validTagIds.length) {
      const pairs = validIds.flatMap((cid) =>
        validTagIds.map((tid) => ({ customerId: cid, tagId: tid }))
      );
      await db.insert(s.customersToTags).values(pairs).onConflictDoNothing();
    }
  }
  if (input.removeTagIds?.length) {
    await db
      .delete(s.customersToTags)
      .where(
        and(
          inArray(s.customersToTags.customerId, validIds),
          inArray(s.customersToTags.tagId, input.removeTagIds)
        )
      );
  }
  paths();
  return { ok: true, updated: validIds.length };
}

// ─── Add Note (legacy activity entry) ──────────────────────
export async function addCustomerNoteEntry(input: {
  customerId: string;
  title: string;
  detail?: string;
}): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findGuarded(ws.id, input.customerId);
  if (!row) return { ok: false, error: 'Kunde nicht gefunden.' };
  const title = input.title.trim();
  if (!title) return { ok: false, error: 'Titel erforderlich.' };
  await db.insert(s.customerActivity).values({
    customerId: input.customerId,
    kind: 'note',
    title,
    detail: input.detail?.trim() || null,
  });
  paths(row.slug);
  return { ok: true };
}

// ─── Share Links ───────────────────────────────────────────
export async function createCustomerShareLink(input: {
  customerId: string;
  expiresInDays?: number | null;
}): Promise<Result<{ token: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findGuarded(ws.id, input.customerId);
  if (!row) return { ok: false, error: 'Kunde nicht gefunden.' };

  const token = randomBytes(24).toString('hex');
  const expiresAt =
    input.expiresInDays && input.expiresInDays > 0
      ? new Date(Date.now() + input.expiresInDays * 86_400_000)
      : null;

  await db.insert(s.customerShareLinks).values({
    workspaceId: ws.id,
    customerId: input.customerId,
    token,
    expiresAt,
    createdById: user.id,
  });
  paths(row.slug);
  return { ok: true, token };
}

export async function revokeCustomerShareLink(linkId: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await db.query.customerShareLinks.findFirst({
    where: and(eq(s.customerShareLinks.id, linkId), eq(s.customerShareLinks.workspaceId, ws.id)),
  });
  if (!row) return { ok: false, error: 'Link nicht gefunden.' };
  await db.delete(s.customerShareLinks).where(eq(s.customerShareLinks.id, linkId));
  paths();
  return { ok: true };
}

// ─── Quote-In-Channel (post a contract into linked channel) ─
export async function postContractIntoChannel(input: {
  customerId: string;
  contractId: string;
  channelId: string;
  body?: string;
}): Promise<Result> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const c = await db.query.contracts.findFirst({
    where: and(eq(s.contracts.id, input.contractId), eq(s.contracts.workspaceId, ws.id)),
  });
  if (!c) return { ok: false, error: 'Vertrag nicht gefunden.' };
  const ch = await db.query.channels.findFirst({
    where: and(eq(s.channels.id, input.channelId), eq(s.channels.workspaceId, ws.id)),
  });
  if (!ch) return { ok: false, error: 'Channel nicht gefunden.' };
  const body =
    input.body?.trim() ||
    `📎 Vertrag: ${c.title}${c.valueCents ? ` · €${(c.valueCents / 100).toLocaleString('de-DE')}` : ''}\nLink: /vertraege/${c.id}`;
  await db.insert(s.messages).values({
    channelId: input.channelId,
    authorId: user.id,
    body,
  });
  revalidatePath(`/channels/${ch.slug}`);
  return { ok: true };
}

// ── Manual customer tagging (Schritt 4b) ────────────────────────
// Link an inbox sender to a customer by adding their email as a contact.
// Deliberately MANUAL — we never auto-guess who is a customer. Once linked,
// the sender resolves as that customer everywhere (Von-Kunden view, churn,
// commitments) via the lower(email) join used across the inbox queries.

/** Lightweight customer list for the "mit Kunde verknüpfen" picker. */
export async function listCustomersForLink(): Promise<
  Array<{ id: string; name: string; initials: string }>
> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  // Minimal projection — the picker only needs id/name/initials, not the full
  // customer graph (contacts/contracts/activity/tags).
  return listCustomersMinimal(ws.id);
}

export async function linkSenderToCustomer(input: {
  customerId: string;
  email: string;
  name?: string | null;
}): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();

  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes('@')) return { ok: false, error: 'Ungültige E-Mail.' };

  // Ownership: the customer must belong to this workspace.
  const customer = await findGuarded(ws.id, input.customerId);
  if (!customer) return { ok: false, error: 'Kunde nicht gefunden.' };

  // Dedup in code — customer_contacts has no (customerId,email) unique index.
  const existing = await db
    .select({ id: s.customerContacts.id })
    .from(s.customerContacts)
    .where(
      and(
        eq(s.customerContacts.customerId, input.customerId),
        sql`lower(${s.customerContacts.email}) = ${email}`
      )
    )
    .limit(1);

  if (existing.length === 0) {
    await db.insert(s.customerContacts).values({
      customerId: input.customerId,
      // name is NOT NULL — fall back to the local-part of the email.
      name: input.name?.trim() || email.split('@')[0],
      email,
    });
  }

  // Surfaces in the inbox views, foyer commitments and churn — refresh broadly.
  revalidatePath('/inbox');
  paths(customer.slug);
  return { ok: true };
}
