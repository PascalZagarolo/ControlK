import 'server-only';
import { and, eq, lt } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { generateToken, hashToken } from './tokens';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_REFRESH_THRESHOLD_MS = 15 * 24 * 60 * 60 * 1000; // refresh when < 15d remaining

export type SessionRecord = {
  id: string;
  userId: string;
  expiresAt: Date;
};

export async function createSession(
  userId: string,
  meta?: { ip?: string | null; userAgent?: string | null }
): Promise<{ token: string; expiresAt: Date }> {
  const db = getDb();
  const { plain, hash } = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(s.sessions).values({
    id: hash,
    userId,
    expiresAt,
    ipAddress: meta?.ip ?? null,
    userAgent: meta?.userAgent ?? null,
  });
  return { token: plain, expiresAt };
}

/**
 * Validates a token and returns the session. Performs sliding refresh
 * (extends the session if less than 15 days remain).
 */
export async function validateSessionToken(
  token: string
): Promise<{ session: SessionRecord; refreshed: boolean } | null> {
  if (!token) return null;
  const db = getDb();
  const hash = hashToken(token);
  const row = await db.query.sessions.findFirst({
    where: eq(s.sessions.id, hash),
  });
  if (!row) return null;
  const now = Date.now();
  if (row.expiresAt.getTime() < now) {
    await db.delete(s.sessions).where(eq(s.sessions.id, hash));
    return null;
  }
  let expiresAt = row.expiresAt;
  let refreshed = false;
  if (expiresAt.getTime() - now < SESSION_REFRESH_THRESHOLD_MS) {
    expiresAt = new Date(now + SESSION_TTL_MS);
    await db.update(s.sessions).set({ expiresAt }).where(eq(s.sessions.id, hash));
    refreshed = true;
  }
  return {
    session: { id: row.id, userId: row.userId, expiresAt },
    refreshed,
  };
}

export async function invalidateSession(tokenHash: string) {
  const db = getDb();
  await db.delete(s.sessions).where(eq(s.sessions.id, tokenHash));
}

export async function invalidateAllUserSessions(userId: string) {
  const db = getDb();
  await db.delete(s.sessions).where(eq(s.sessions.userId, userId));
}

export async function listUserSessions(userId: string) {
  const db = getDb();
  return db.query.sessions.findMany({
    where: and(eq(s.sessions.userId, userId), lt(s.sessions.expiresAt, new Date(Date.now() + SESSION_TTL_MS * 2))),
  });
}
