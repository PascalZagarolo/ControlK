import 'server-only';
import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { getSessionToken } from './cookies';
import { validateSessionToken } from './sessions';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  initials: string;
  avatarFrom: string;
  avatarTo: string;
  emailVerified: boolean;
  totpEnabled: boolean;
  sessionExpiresAt: Date;
};

export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const token = await getSessionToken();
  if (!token) return null;
  const result = await validateSessionToken(token);
  if (!result) return null;
  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(s.users.id, result.session.userId),
  });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    initials: user.initials,
    avatarFrom: user.avatarFrom,
    avatarTo: user.avatarTo,
    emailVerified: !!user.emailVerifiedAt,
    totpEnabled: !!user.totpEnabledAt,
    sessionExpiresAt: result.session.expiresAt,
  };
});

export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) throw new Error('Not authenticated');
  return u;
}

export function hasAuth() {
  return true;
}
