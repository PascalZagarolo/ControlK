import 'server-only';
import webpush from 'web-push';
import { eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';

// Web-Push sender. VAPID keys come from env; when they're missing the whole
// feature no-ops gracefully (like aiAvailable) so dev/preview without keys
// never crashes. Generate once with `npx web-push generate-vapid-keys` and set
// VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT (+ the public key as
// NEXT_PUBLIC_VAPID_PUBLIC_KEY for the client) in the environment.

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:hello@ctrlk.de';
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function pushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export type PushPayload = {
  title: string;
  body: string;
  /** Deep-link opened on tap. */
  url?: string;
};

/**
 * Send a push to every subscription a user has. Dead endpoints (404/410) are
 * pruned. Returns how many devices were reached. No-op when VAPID is unset.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!ensureConfigured()) return 0;
  const db = getDb();
  const subs = await db
    .select()
    .from(s.pushSubscriptions)
    .where(eq(s.pushSubscriptions.userId, userId));
  if (subs.length === 0) return 0;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/plan',
  });

  const dead: string[] = [];
  let sent = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
        sent += 1;
      } catch (e: unknown) {
        const status = (e as { statusCode?: number })?.statusCode;
        // 404 Not Found / 410 Gone → the subscription is dead; drop it.
        if (status === 404 || status === 410) dead.push(sub.id);
        else console.warn('[web-push] send failed', status ?? e);
      }
    })
  );

  if (dead.length > 0) {
    await db
      .delete(s.pushSubscriptions)
      .where(inArray(s.pushSubscriptions.id, dead))
      .catch((e) => console.warn('[web-push] pruning dead subscriptions failed', e));
  }
  return sent;
}
