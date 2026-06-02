'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { normalizeIdentifier, emailDomain } from '@/lib/clients/resolve';

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

// Manual client tagging — Schritt 5. Strictly user-initiated; we NEVER
// auto-tag a sender (a wrong guess destroys trust — cf. removed "Wichtige
// Absender" logic, Schritt 2).
// TODO: optionale Auto-Kunden-Erkennung später (separates Feature).

/**
 * Tag a sender (or their whole domain) as a client. Low-friction: callable
 * straight from a mail. Upserts on (user, identifier) so re-tagging just
 * updates the display name — never duplicates.
 */
export async function tagContact(input: {
  identifier: string;
  kind: 'email' | 'domain';
  displayName?: string | null;
}): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();

  const norm = normalizeIdentifier(input.identifier, input.kind);
  if (!norm.ok) return { ok: false, error: norm.error };

  const displayName = input.displayName?.trim() || null;

  const [row] = await db
    .insert(s.contactTags)
    .values({
      workspaceId: ws.id,
      userId: user.id,
      kind: input.kind,
      identifier: norm.identifier,
      displayName,
    })
    .onConflictDoUpdate({
      target: [s.contactTags.userId, s.contactTags.identifier],
      set: { displayName, kind: input.kind, workspaceId: ws.id },
    })
    .returning({ id: s.contactTags.id });

  revalidatePath('/inbox');
  revalidatePath('/plan');
  return { ok: true, id: row.id };
}

/** Convenience for the one-tap "als Kunde markieren" from an email address. */
export async function tagSenderAsClient(input: {
  email: string;
  /** 'email' (just this address) or 'domain' (the whole company). */
  scope: 'email' | 'domain';
  displayName?: string | null;
}): Promise<Result<{ id: string }>> {
  if (input.scope === 'domain') {
    const domain = emailDomain(input.email);
    if (!domain) return { ok: false, error: 'Keine Domain erkennbar.' };
    return tagContact({ identifier: domain, kind: 'domain', displayName: input.displayName });
  }
  return tagContact({ identifier: input.email, kind: 'email', displayName: input.displayName });
}

/** Remove a client tag (by id, ownership-checked). */
export async function untagContact(id: string): Promise<Result> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  await db
    .delete(s.contactTags)
    .where(
      and(
        eq(s.contactTags.id, id),
        eq(s.contactTags.userId, user.id),
        eq(s.contactTags.workspaceId, ws.id)
      )
    );
  revalidatePath('/inbox');
  revalidatePath('/inbox/clients');
  revalidatePath('/kunden');
  revalidatePath('/plan');
  return { ok: true };
}

/**
 * Update a tagged client's voluntary fields — display name and/or the optional
 * note. The note is the ONLY free-text input in the calm customer overview;
 * there are no structured/maintained CRM fields. Ownership-checked.
 */
export async function updateContactTag(input: {
  id: string;
  displayName?: string | null;
  note?: string | null;
}): Promise<Result> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const patch: { displayName?: string | null; note?: string | null } = {};
  if (input.displayName !== undefined) {
    const dn = input.displayName?.trim();
    patch.displayName = dn ? dn.slice(0, 120) : null;
  }
  if (input.note !== undefined) {
    const n = input.note?.trim();
    patch.note = n ? n.slice(0, 2000) : null;
  }
  if (Object.keys(patch).length === 0) return { ok: true };
  const [row] = await db
    .update(s.contactTags)
    .set(patch)
    .where(
      and(
        eq(s.contactTags.id, input.id),
        eq(s.contactTags.userId, user.id),
        eq(s.contactTags.workspaceId, ws.id)
      )
    )
    .returning({ id: s.contactTags.id });
  if (!row) return { ok: false, error: 'Kunde nicht gefunden.' };
  revalidatePath('/kunden');
  revalidatePath('/inbox/clients');
  revalidatePath('/plan');
  return { ok: true };
}

/**
 * Dismiss a suggested client tag ("nicht als Kunde") so it stops being
 * proposed. Per-user; identifier is the lowercased email/domain.
 */
export async function dismissClientSuggestion(identifier: string): Promise<Result> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const id = identifier.trim().toLowerCase();
  if (!id) return { ok: false, error: 'Ungültig.' };
  const db = getDb();
  await db
    .insert(s.clientSuggestionDismissals)
    .values({ workspaceId: ws.id, userId: user.id, identifier: id })
    .onConflictDoNothing({
      target: [
        s.clientSuggestionDismissals.workspaceId,
        s.clientSuggestionDismissals.userId,
        s.clientSuggestionDismissals.identifier,
      ],
    });
  revalidatePath('/kunden');
  return { ok: true };
}

/** Is this email already tagged (exact OR via its domain)? Drives the UI toggle. */
export async function isSenderTagged(email: string): Promise<boolean> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const e = email.trim().toLowerCase();
  const domain = emailDomain(e);
  const [row] = await db
    .select({ id: s.contactTags.id })
    .from(s.contactTags)
    .where(
      and(
        eq(s.contactTags.workspaceId, ws.id),
        eq(s.contactTags.userId, user.id),
        domain
          ? sql`${s.contactTags.identifier} in (${e}, ${domain})`
          : eq(s.contactTags.identifier, e)
      )
    )
    .limit(1);
  return !!row;
}
