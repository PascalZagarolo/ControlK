import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb, hasDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import {
  googleConfigured,
  exchangeCode,
  verifyIdToken,
} from '@/lib/auth/google-oauth';
import { createSession } from '@/lib/auth/sessions';
import { setSessionCookie } from '@/lib/auth/cookies';
import { newUserId } from '@/lib/auth/tokens';

export const dynamic = 'force-dynamic';

function fail(origin: string, reason: string) {
  const url = new URL('/sign-in', origin);
  url.searchParams.set('oauth_error', reason);
  return NextResponse.redirect(url, { status: 303 });
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? 'u') + (parts[1]?.[0] ?? '')).toUpperCase().slice(0, 4);
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 32) || 'workspace'
  );
}

async function uniqueWorkspaceSlug(base: string): Promise<string> {
  const db = getDb();
  let attempt = base;
  for (let i = 0; i < 8; i++) {
    const existing = await db.query.workspaces.findFirst({
      where: eq(s.workspaces.slug, attempt),
    });
    if (!existing) return attempt;
    attempt = `${base}-${Math.floor(Math.random() * 9999)}`;
  }
  return `${base}-${Date.now()}`;
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;

  if (!googleConfigured()) return fail(origin, 'not_configured');
  if (!hasDb()) return fail(origin, 'no_db');

  const params = req.nextUrl.searchParams;
  const oauthError = params.get('error');
  if (oauthError) {
    // Most common: user clicked "Cancel" → Google sends ?error=access_denied.
    return fail(origin, oauthError);
  }

  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) return fail(origin, 'missing_params');

  const db = getDb();
  const row = await db.query.oauthStates.findFirst({
    where: eq(s.oauthStates.state, state),
  });
  if (!row) return fail(origin, 'invalid_state');

  // Burn the state row immediately — one-time use, regardless of what
  // happens next. Prevents a stolen state from being replayed.
  await db.delete(s.oauthStates).where(eq(s.oauthStates.state, state));

  if (row.expiresAt.getTime() < Date.now()) return fail(origin, 'state_expired');
  if (row.provider !== 'google') return fail(origin, 'provider_mismatch');

  // redirect_uri must exactly match what we sent to Google on /start.
  // We persisted the origin then, so we use that — not the current
  // request's origin (which could differ on edge cases like host swaps).
  const redirectUri = `${row.origin}/api/auth/google/callback`;

  let claims;
  try {
    const { idToken } = await exchangeCode({
      code,
      codeVerifier: row.codeVerifier,
      redirectUri,
    });
    claims = await verifyIdToken(idToken, row.nonce);
  } catch (e) {
    console.error(
      '[oauth/google/callback] exchange/verify failed:',
      e instanceof Error ? e.message : e
    );
    return fail(origin, 'token_exchange_failed');
  }

  // We only auto-link / auto-create on Google-verified emails. In
  // practice Google nearly always verifies, but we'd rather bounce
  // unverified edge cases than risk an account-takeover by email match.
  if (!claims.emailVerified) return fail(origin, 'email_not_verified');

  let userId: string;

  const existingOauth = await db.query.oauthAccounts.findFirst({
    where: and(
      eq(s.oauthAccounts.provider, 'google'),
      eq(s.oauthAccounts.providerAccountId, claims.sub)
    ),
  });

  if (existingOauth) {
    userId = existingOauth.userId;
    await db
      .update(s.oauthAccounts)
      .set({
        email: claims.email,
        name: claims.name ?? null,
        avatarUrl: claims.picture ?? null,
        updatedAt: new Date(),
      })
      .where(eq(s.oauthAccounts.id, existingOauth.id));
  } else {
    // No Google-linked row → look for an existing user by email and link.
    const existingUser = await db.query.users.findFirst({
      where: eq(s.users.email, claims.email),
    });

    if (existingUser) {
      userId = existingUser.id;
      await db.insert(s.oauthAccounts).values({
        userId,
        provider: 'google',
        providerAccountId: claims.sub,
        email: claims.email,
        name: claims.name ?? null,
        avatarUrl: claims.picture ?? null,
      });
      if (!existingUser.emailVerifiedAt) {
        // Google says this email is verified, so we can mark our row.
        await db
          .update(s.users)
          .set({ emailVerifiedAt: new Date() })
          .where(eq(s.users.id, userId));
      }
    } else {
      // Brand-new sign-up via Google. Create user + workspace + oauth row.
      const name = (claims.name ?? '').trim() || claims.email.split('@')[0];
      const id = newUserId();
      await db.insert(s.users).values({
        id,
        email: claims.email,
        name,
        initials: initialsFromName(name),
        emailVerifiedAt: new Date(),
      });
      await db.insert(s.oauthAccounts).values({
        userId: id,
        provider: 'google',
        providerAccountId: claims.sub,
        email: claims.email,
        name: claims.name ?? null,
        avatarUrl: claims.picture ?? null,
      });
      const wsSlug = await uniqueWorkspaceSlug(slugify(name));
      const [ws] = await db
        .insert(s.workspaces)
        .values({
          slug: wsSlug,
          name: `${name.split(' ')[0]}'s Workspace`,
          short: initialsFromName(name).slice(0, 2),
          fromColor: '#5eb6ff',
          toColor: '#0369a1',
          ownerId: id,
        })
        .returning();
      await db.insert(s.workspaceMembers).values({
        workspaceId: ws.id,
        userId: id,
        role: 'owner',
      });
      userId = id;
    }
  }

  // Session. Note: we intentionally don't enforce local TOTP on the
  // OAuth path — magic-link login behaves the same way. The IdP attests
  // identity; the second factor lives on the user's Google account.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const userAgent = req.headers.get('user-agent') ?? null;
  const { token, expiresAt } = await createSession(userId, { ip, userAgent });
  await setSessionCookie(token, expiresAt);

  const dest = new URL(row.redirectTo || '/', origin);
  return NextResponse.redirect(dest, { status: 303 });
}
