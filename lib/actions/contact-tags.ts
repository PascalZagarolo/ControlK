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
  revalidatePath('/plan');
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
