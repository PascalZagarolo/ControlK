'use server';

import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

// Subscribe/unsubscribe the current user's browser to Web-Push nudges. The
// subscription comes from the browser's PushManager; we store the endpoint +
// the two keys needed to encrypt payloads. Endpoint is unique → re-subscribe
// updates the same row rather than duplicating.

export async function savePushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}): Promise<Result> {
  const user = await requireUser();
  if (!input.endpoint || !input.p256dh || !input.auth) {
    return { ok: false, error: 'Ungültige Subscription.' };
  }
  const db = getDb();
  await db
    .insert(s.pushSubscriptions)
    .values({
      userId: user.id,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent?.slice(0, 400) ?? null,
    })
    .onConflictDoUpdate({
      target: s.pushSubscriptions.endpoint,
      // A push endpoint is per-browser/device, so it has exactly one owner: the
      // last person to subscribe on it. Re-subscribing (rotated keys, or a
      // different user on a shared device) rebinds the endpoint to them and
      // resets the nudge cooldown. No data leak — pushes are always computed
      // from the current owner's data.
      set: { userId: user.id, p256dh: input.p256dh, auth: input.auth, lastNudgedAt: null },
    });
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<Result> {
  const user = await requireUser();
  const db = getDb();
  await db
    .delete(s.pushSubscriptions)
    .where(
      and(eq(s.pushSubscriptions.endpoint, endpoint), eq(s.pushSubscriptions.userId, user.id))
    );
  return { ok: true };
}
