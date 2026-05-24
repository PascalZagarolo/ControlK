import 'server-only';

import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { decryptSecret, encryptSecret } from './secret-encryption';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

// Refresh the access token if it expires in less than this many ms.
const REFRESH_LEEWAY_MS = 5 * 60_000;

export type GoogleConnection = {
  oauthAccountId: string;
  email: string | null;
  scopes: string[];
  // True if the row has a refresh_token + access token is usable (or
  // refreshable). False if the user is connected for sign-in only.
  hasOfflineAccess: boolean;
};

/**
 * Look up the Google OAuth row for a user. Returns null when the user
 * has never signed in with Google.
 */
export async function getGoogleConnection(
  userId: string
): Promise<GoogleConnection | null> {
  const db = getDb();
  const row = await db.query.oauthAccounts.findFirst({
    where: and(
      eq(s.oauthAccounts.userId, userId),
      eq(s.oauthAccounts.provider, 'google')
    ),
    columns: {
      id: true,
      email: true,
      refreshTokenEnc: true,
      scopes: true,
    },
  });
  if (!row) return null;
  return {
    oauthAccountId: row.id,
    email: row.email,
    scopes: (row.scopes ?? '').split(/\s+/).filter(Boolean),
    hasOfflineAccess: !!row.refreshTokenEnc,
  };
}

/**
 * Returns a valid Google access token for the user, refreshing it if
 * close to expiry. Returns null if the user has no Google connection
 * with offline access, or if Google has revoked the refresh token.
 *
 * Calling code should treat null as "user needs to (re-)connect Gmail".
 */
export async function getValidGoogleAccessToken(
  userId: string
): Promise<string | null> {
  const db = getDb();
  const row = await db.query.oauthAccounts.findFirst({
    where: and(
      eq(s.oauthAccounts.userId, userId),
      eq(s.oauthAccounts.provider, 'google')
    ),
  });
  if (!row || !row.refreshTokenEnc) return null;

  const expiresAt = row.accessTokenExpiresAt
    ? new Date(row.accessTokenExpiresAt).getTime()
    : 0;
  const stillFresh =
    row.accessTokenEnc && expiresAt - Date.now() > REFRESH_LEEWAY_MS;

  if (stillFresh) {
    const plain = decryptSecret(row.accessTokenEnc!);
    if (plain) return plain;
    // decrypt failed → fall through to refresh
  }

  const refreshTokenPlain = decryptSecret(row.refreshTokenEnc);
  if (!refreshTokenPlain) return null;

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshTokenPlain,
    grant_type: 'refresh_token',
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });

  if (!res.ok) {
    // 400/401 typically means the refresh token was revoked by the user
    // in their Google account settings, or the consent was withdrawn.
    // Clear the token state so the UI prompts a re-connect.
    if (res.status === 400 || res.status === 401) {
      console.warn(
        `[google-tokens] refresh failed (${res.status}) — clearing tokens for user ${userId}`
      );
      await db
        .update(s.oauthAccounts)
        .set({
          accessTokenEnc: null,
          refreshTokenEnc: null,
          accessTokenExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(s.oauthAccounts.id, row.id));
    }
    return null;
  }

  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    scope?: string;
  };

  if (!json.access_token) return null;

  let accessTokenEnc: string | null = null;
  try {
    accessTokenEnc = encryptSecret(json.access_token);
  } catch {
    // No APP_ENCRYPTION_KEY — we can still return the fresh token to the
    // caller for the current request, but won't persist it.
  }

  await db
    .update(s.oauthAccounts)
    .set({
      accessTokenEnc,
      accessTokenExpiresAt: json.expires_in
        ? new Date(Date.now() + json.expires_in * 1000)
        : null,
      scopes: json.scope ?? row.scopes,
      updatedAt: new Date(),
    })
    .where(eq(s.oauthAccounts.id, row.id));

  return json.access_token;
}

/**
 * Hard-disconnect: tells Google to revoke the refresh token, then
 * clears local state. Used by the "Gmail trennen" button in Settings.
 *
 * Even if the revoke call fails (network/Google issue), we still wipe
 * local tokens — the user's intent is clear and we don't want to keep
 * stale credentials around.
 */
export async function disconnectGoogle(userId: string): Promise<void> {
  const db = getDb();
  const row = await db.query.oauthAccounts.findFirst({
    where: and(
      eq(s.oauthAccounts.userId, userId),
      eq(s.oauthAccounts.provider, 'google')
    ),
    columns: { id: true, refreshTokenEnc: true },
  });
  if (!row) return;

  if (row.refreshTokenEnc) {
    const refresh = decryptSecret(row.refreshTokenEnc);
    if (refresh) {
      try {
        await fetch(`${REVOKE_URL}?token=${encodeURIComponent(refresh)}`, {
          method: 'POST',
          cache: 'no-store',
        });
      } catch (e) {
        console.warn('[google-tokens] revoke call failed (ignored):', e);
      }
    }
  }

  await db
    .update(s.oauthAccounts)
    .set({
      accessTokenEnc: null,
      refreshTokenEnc: null,
      accessTokenExpiresAt: null,
      scopes: null,
      updatedAt: new Date(),
    })
    .where(eq(s.oauthAccounts.id, row.id));
}
