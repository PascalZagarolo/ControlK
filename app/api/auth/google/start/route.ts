import { NextResponse, type NextRequest } from 'next/server';
import { getDb, hasDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import {
  googleConfigured,
  buildAuthUrl,
  newCodeVerifier,
  codeChallengeFor,
  newState,
  newNonce,
} from '@/lib/auth/google-oauth';
import { checkRateLimit } from '@/lib/auth/rate-limit';

export const dynamic = 'force-dynamic';

const STATE_TTL_MS = 10 * 60 * 1000;

// Only accept relative paths to prevent open-redirect via ?from=https://evil.
function safeRedirect(input: string | null): string {
  if (!input) return '/';
  if (input.startsWith('/') && !input.startsWith('//')) return input;
  return '/';
}

// Whitelist of OAuth scopes a request can ask for beyond the base
// "who is this person" set. Lock this down so a malicious link can't
// silently escalate to drive.readonly or whatever else.
//
// gmail.modify supersedes gmail.readonly (Google grants both when the
// caller asks for modify), so the "Mit Gmail verbinden" CTA in
// Settings asks for modify and gets read + modify in one consent.
const ALLOWED_EXTRA_SCOPES = new Set<string>([
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
]);

function parseExtraScopes(input: string | null): string[] {
  if (!input) return [];
  return input
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && ALLOWED_EXTRA_SCOPES.has(s));
}

function fail(origin: string, reason: string) {
  const url = new URL('/sign-in', origin);
  url.searchParams.set('oauth_error', reason);
  return NextResponse.redirect(url, { status: 303 });
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;

  if (!googleConfigured()) return fail(origin, 'not_configured');
  if (!hasDb()) return fail(origin, 'no_db');

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = await checkRateLimit('oauth-google', `ip:${ip}`);
  if (!rl.ok) return fail(origin, 'rate_limited');

  const redirectTo = safeRedirect(req.nextUrl.searchParams.get('from'));
  const extraScopes = parseExtraScopes(req.nextUrl.searchParams.get('scopes'));
  const redirectUri = `${origin}/api/auth/google/callback`;

  const state = newState();
  const codeVerifier = newCodeVerifier();
  const codeChallenge = codeChallengeFor(codeVerifier);
  const nonce = newNonce();

  try {
    const db = getDb();
    await db.insert(s.oauthStates).values({
      state,
      provider: 'google',
      codeVerifier,
      nonce,
      redirectTo,
      origin,
      expiresAt: new Date(Date.now() + STATE_TTL_MS),
    });
  } catch (e) {
    console.error('[oauth/google/start] state insert failed:', e);
    return fail(origin, 'state_insert_failed');
  }

  const url = buildAuthUrl({
    state,
    codeChallenge,
    nonce,
    redirectUri,
    extraScopes,
  });
  return NextResponse.redirect(url, { status: 303 });
}
