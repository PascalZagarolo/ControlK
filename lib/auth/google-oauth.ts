import 'server-only';

import crypto from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';

// Google OpenID Connect endpoints. These are stable — Google publishes
// the discovery doc at https://accounts.google.com/.well-known/openid-configuration
// but the endpoints don't change in practice, so we inline them and skip
// the discovery roundtrip on every request.
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

// createRemoteJWKSet caches keys with refresh-on-miss, so importing this
// module once per process is fine — repeated verifications reuse cached
// keys instead of hammering Google.
const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

export function googleConfigured(): boolean {
  return !!process.env.GOOGLE_OAUTH_CLIENT_ID && !!process.env.GOOGLE_OAUTH_CLIENT_SECRET;
}

function clientId(): string {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!id) throw new Error('GOOGLE_OAUTH_CLIENT_ID is not set');
  return id;
}

function clientSecret(): string {
  const s = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!s) throw new Error('GOOGLE_OAUTH_CLIENT_SECRET is not set');
  return s;
}

// PKCE: RFC 7636. Verifier is 43-128 chars of [A-Z][a-z][0-9]-._~,
// challenge = BASE64URL(SHA256(verifier)). We generate 48 random bytes
// → 64-char base64url string, comfortably above the 43-char minimum.

export function newCodeVerifier(): string {
  return crypto.randomBytes(48).toString('base64url');
}

export function codeChallengeFor(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function newState(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function newNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Base scopes for plain "who is this person" sign-in. Any scope beyond
// this list (e.g. Gmail readonly) is opt-in and lives in extraScopes.
const BASE_SCOPES = ['openid', 'email', 'profile'];

export function buildAuthUrl(opts: {
  state: string;
  codeChallenge: string;
  nonce: string;
  redirectUri: string;
  loginHint?: string;
  extraScopes?: string[];
}): string {
  const url = new URL(AUTH_URL);
  // Dedup scopes so requesting "email" + an extra scope doesn't double-bill.
  const scopes = Array.from(new Set([...BASE_SCOPES, ...(opts.extraScopes ?? [])]));
  const hasExtras = scopes.length > BASE_SCOPES.length;

  url.searchParams.set('client_id', clientId());
  url.searchParams.set('redirect_uri', opts.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes.join(' '));
  url.searchParams.set('state', opts.state);
  url.searchParams.set('nonce', opts.nonce);
  url.searchParams.set('code_challenge', opts.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  // For extra-scope flows we MUST force consent so Google issues a
  // refresh token. Without prompt=consent the user gets a silent
  // redirect and we never see refresh_token in the response.
  url.searchParams.set('prompt', hasExtras ? 'consent' : 'select_account');
  url.searchParams.set('access_type', hasExtras ? 'offline' : 'online');
  if (hasExtras) {
    // Lets Google return a refresh token even if the user previously
    // approved this client without one.
    url.searchParams.set('include_granted_scopes', 'true');
  }
  if (opts.loginHint) url.searchParams.set('login_hint', opts.loginHint);
  return url.toString();
}

export type TokenExchangeResult = {
  idToken: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number; // seconds until access_token expires
  scope?: string; // space-separated list of granted scopes
};

export async function exchangeCode(opts: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<TokenExchangeResult> {
  const body = new URLSearchParams({
    code: opts.code,
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: opts.redirectUri,
    grant_type: 'authorization_code',
    code_verifier: opts.codeVerifier,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    // Token endpoint must not be cached.
    cache: 'no-store',
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Google token exchange failed (${res.status}): ${errBody.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    id_token?: string;
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!json.id_token) throw new Error('Google did not return an id_token');
  return {
    idToken: json.id_token,
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in,
    scope: json.scope,
  };
}

export type GoogleClaims = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
};

export async function verifyIdToken(idToken: string, nonce: string): Promise<GoogleClaims> {
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: ISSUERS,
    audience: clientId(),
    // 30 s clock skew tolerance — Google's clocks are accurate but ours
    // might drift slightly on cold-started instances.
    clockTolerance: '30s',
  });
  if (payload.nonce !== nonce) throw new Error('id_token nonce mismatch');
  if (typeof payload.sub !== 'string' || !payload.sub) {
    throw new Error('id_token missing sub');
  }
  if (typeof payload.email !== 'string' || !payload.email) {
    throw new Error('id_token missing email');
  }
  return {
    sub: payload.sub,
    email: String(payload.email).toLowerCase(),
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === 'string' ? payload.name : undefined,
    picture: typeof payload.picture === 'string' ? payload.picture : undefined,
  };
}
