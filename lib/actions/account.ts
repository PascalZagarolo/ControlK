'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { verifyPassword } from '@/lib/auth/password';
import { clearSessionCookie } from '@/lib/auth/cookies';

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * GDPR Article 20 — Right to data portability.
 * Aggregates everything the user owns into a single JSON blob.
 */
export async function exportAccountData(): Promise<Result<{ filename: string; json: string }>> {
  const user = await requireUser();
  const db = getDb();

  const [profile, sessions, ownedWorkspaces, memberships, messages, notifications] =
    await Promise.all([
      db.query.users.findFirst({
        where: eq(s.users.id, user.id),
        columns: { passwordHash: false, totpSecret: false },
      }),
      db.query.sessions.findMany({ where: eq(s.sessions.userId, user.id) }),
      db.query.workspaces.findMany({ where: eq(s.workspaces.ownerId, user.id) }),
      db.query.workspaceMembers.findMany({ where: eq(s.workspaceMembers.userId, user.id) }),
      db.query.messages.findMany({ where: eq(s.messages.authorId, user.id) }),
      db.query.notifications.findMany({ where: eq(s.notifications.userId, user.id) }),
    ]);

  const blob = {
    exportedAt: new Date().toISOString(),
    profile,
    sessions,
    ownedWorkspaces,
    memberships,
    messages,
    notifications,
  };

  return {
    ok: true,
    filename: `urent-export-${user.id}-${Date.now()}.json`,
    json: JSON.stringify(blob, null, 2),
  };
}

/**
 * GDPR Article 17 — Right to erasure.
 * Hard-deletes the user. Cascades remove sessions, messages, notifications, workspaces (if owner).
 */
export async function deleteAccount(formData: FormData): Promise<Result> {
  const user = await requireUser();
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (confirm !== 'LÖSCHEN') {
    return { ok: false, error: 'Bitte tippe LÖSCHEN zur Bestätigung.' };
  }
  const db = getDb();
  const row = await db.query.users.findFirst({ where: eq(s.users.id, user.id) });
  if (!row) return { ok: false, error: 'Konto nicht gefunden.' };
  if (row.passwordHash) {
    const ok = await verifyPassword(password, row.passwordHash);
    if (!ok) return { ok: false, error: 'Passwort falsch.' };
  }

  await db.delete(s.users).where(eq(s.users.id, user.id));
  await clearSessionCookie();
  redirect('/sign-in');
}

export async function signOutAction() {
  const { signOut } = await import('./auth');
  await signOut();
}
