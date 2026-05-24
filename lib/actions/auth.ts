'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { generateToken, hashToken, newUserId } from '@/lib/auth/tokens';
import {
  createSession,
  invalidateAllUserSessions,
  invalidateSession,
} from '@/lib/auth/sessions';
import { setSessionCookie, clearSessionCookie, getSessionToken } from '@/lib/auth/cookies';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import {
  sendMail,
  appUrl,
  verifyEmailTemplate,
  resetPasswordTemplate,
  magicLinkTemplate,
} from '@/lib/email/send';
import {
  sendNewDeviceLoginAlert,
  sendPasswordChangedAlert,
} from '@/lib/auth/security-mails';
import { verifySync } from 'otplib';

type Result = { ok: true } | { ok: false; error: string };

async function clientInfo() {
  const h = await headers();
  return {
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: h.get('user-agent') ?? null,
  };
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? 'u') + (parts[1]?.[0] ?? '')).toUpperCase().slice(0, 4);
}

function emailValid(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

// ─── Sign Up ────────────────────────────────────────────────────
export async function signUp(formData: FormData): Promise<Result> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  if (!emailValid(email)) return { ok: false, error: 'Ungültige E-Mail.' };
  if (password.length < 8) return { ok: false, error: 'Passwort muss mindestens 8 Zeichen haben.' };
  if (!name) return { ok: false, error: 'Name fehlt.' };

  const info = await clientInfo();
  const rl = await checkRateLimit('sign-up', `ip:${info.ip ?? 'unknown'}`);
  if (!rl.ok) return { ok: false, error: `Zu viele Versuche. Bitte warte ${rl.retryAfterSec}s.` };

  const db = getDb();
  const existing = await db.query.users.findFirst({ where: eq(s.users.email, email) });
  if (existing) return { ok: false, error: 'Diese E-Mail ist bereits registriert.' };

  const passwordHash = await hashPassword(password);
  const id = newUserId();
  await db.insert(s.users).values({
    id,
    email,
    name,
    initials: initialsFromName(name),
    passwordHash,
    // emailVerifiedAt stays null — the verification mail goes out at
    // the bottom of this function and the user has to click the link.
    // Until then a banner in the root layout reminds them.
  });

  // Bootstrap: create a personal workspace + add user as owner-member.
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

  const { token, expiresAt } = await createSession(id, info);
  await setSessionCookie(token, expiresAt);

  // Verification mail — fire-and-forget. If sending fails for any reason
  // (Resend down, key missing, …) we still let the user in; they can
  // resend from the in-app banner. Don't surface the failure as a
  // sign-up error.
  void enqueueVerificationEmail(id, email).catch((e) => {
    console.error('[signUp] verification email failed:', e);
  });

  return { ok: true };
}

/**
 * Creates a one-time verification token in email_verifications and
 * sends the user the link mail. Reusable from signUp and from the
 * "Erneut senden" button on the verify banner.
 */
export async function enqueueVerificationEmail(
  userId: string,
  email: string
): Promise<void> {
  const db = getDb();
  const { plain, hash } = generateToken();
  await db.insert(s.emailVerifications).values({
    userId,
    email,
    tokenHash: hash,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  const link = `${appUrl()}/verify-email?token=${plain}`;
  await sendMail({ to: email, ...verifyEmailTemplate(link) });
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 32) || 'workspace';
}

async function uniqueWorkspaceSlug(base: string): Promise<string> {
  const db = getDb();
  let attempt = base;
  for (let i = 0; i < 8; i++) {
    const existing = await db.query.workspaces.findFirst({ where: eq(s.workspaces.slug, attempt) });
    if (!existing) return attempt;
    attempt = `${base}-${Math.floor(Math.random() * 9999)}`;
  }
  return `${base}-${Date.now()}`;
}

// ─── Sign In ────────────────────────────────────────────────────
export async function signIn(formData: FormData): Promise<Result & { needsTotp?: boolean }> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');
  const totp = String(formData.get('totp') ?? '').trim();
  if (!emailValid(email) || !password) return { ok: false, error: 'E-Mail und Passwort eingeben.' };

  const info = await clientInfo();
  const rlIp = await checkRateLimit('sign-in', `ip:${info.ip ?? 'unknown'}`);
  if (!rlIp.ok) return { ok: false, error: `Zu viele Versuche. Bitte warte ${rlIp.retryAfterSec}s.` };
  const rlEmail = await checkRateLimit('sign-in', `email:${email}`);
  if (!rlEmail.ok) return { ok: false, error: `Zu viele Versuche. Bitte warte ${rlEmail.retryAfterSec}s.` };

  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(s.users.email, email) });
  // generic error to avoid user-enum
  const fail = { ok: false as const, error: 'E-Mail oder Passwort falsch.' };
  if (!user || !user.passwordHash) return fail;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return fail;

  if (user.totpSecret && user.totpEnabledAt) {
    if (!totp) return { ok: false, error: 'Zwei-Faktor-Code erforderlich.', needsTotp: true };
    const result = verifySync({ token: totp, secret: user.totpSecret });
    if (!result.valid) return { ok: false, error: 'Ungültiger 2FA-Code.', needsTotp: true };
  }

  // Detect "new device" BEFORE creating this login's session so the
  // current session doesn't count as prior history. Compare the IP
  // + UA pair against the user's existing sessions.
  const isNewDevice = await detectNewDevice(user.id, info.ip, info.userAgent);

  const { token, expiresAt } = await createSession(user.id, info);
  await setSessionCookie(token, expiresAt);

  if (isNewDevice) {
    sendNewDeviceLoginAlert({
      email: user.email,
      ip: info.ip,
      userAgent: info.userAgent,
    });
  }

  return { ok: true };
}

/**
 * Returns true when no prior session for the user matches the given
 * (ip, userAgent) pair. Conservative on null inputs — if we can't
 * fingerprint, we treat as "not new" to avoid noisy alerts.
 */
async function detectNewDevice(
  userId: string,
  ip: string | null,
  userAgent: string | null
): Promise<boolean> {
  if (!ip && !userAgent) return false;
  const db = getDb();
  const rows = await db.query.sessions.findMany({
    where: eq(s.sessions.userId, userId),
    columns: { ipAddress: true, userAgent: true },
    limit: 50,
  });
  if (rows.length === 0) {
    // First-ever session for this user — already counts as "the new
    // device", so don't alert (they're literally setting it up now).
    return false;
  }
  const match = rows.some(
    (r) =>
      (ip ? r.ipAddress === ip : true) &&
      (userAgent ? r.userAgent === userAgent : true)
  );
  return !match;
}

// ─── Sign Out ───────────────────────────────────────────────────
export async function signOut() {
  const token = await getSessionToken();
  if (token) await invalidateSession(hashToken(token));
  await clearSessionCookie();
  redirect('/sign-in');
}

export async function signOutAllSessions(userId: string) {
  await invalidateAllUserSessions(userId);
  await clearSessionCookie();
}

// ─── Email verification ────────────────────────────────────────

/**
 * Re-sends the verification mail for the currently signed-in user.
 * Rate-limited per-user so a runaway "Erneut senden" click doesn't
 * blast Resend. Always returns ok=true to avoid leaking info about
 * which emails exist.
 */
export async function resendVerificationEmail(): Promise<Result> {
  const db = getDb();
  const info = await clientInfo();
  // Reuse the existing forgot-password rate-limit bucket — same
  // human-pace expectation, no need for a new bucket name.
  const rl = await checkRateLimit('forgot-password', `ip:${info.ip ?? 'unknown'}`);
  if (!rl.ok) {
    return { ok: false, error: `Zu viele Versuche. Bitte warte ${rl.retryAfterSec}s.` };
  }
  // Lazy session lookup — avoids importing requireUser at module top.
  const { currentUser } = await import('@/lib/auth/current-user');
  const user = await currentUser();
  if (!user) return { ok: true };
  if (user.emailVerified) return { ok: true };
  await enqueueVerificationEmail(user.id, user.email);
  return { ok: true };
}

export async function verifyEmail(token: string): Promise<Result> {
  const db = getDb();
  const hash = hashToken(token);
  const row = await db.query.emailVerifications.findFirst({
    where: and(
      eq(s.emailVerifications.tokenHash, hash),
      isNull(s.emailVerifications.consumedAt),
      gt(s.emailVerifications.expiresAt, new Date())
    ),
  });
  if (!row) return { ok: false, error: 'Ungültiger oder abgelaufener Link.' };

  await db
    .update(s.emailVerifications)
    .set({ consumedAt: new Date() })
    .where(eq(s.emailVerifications.id, row.id));
  await db.update(s.users).set({ emailVerifiedAt: new Date() }).where(eq(s.users.id, row.userId));
  return { ok: true };
}

// ─── Password reset ────────────────────────────────────────────
export async function requestPasswordReset(formData: FormData): Promise<Result> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const info = await clientInfo();
  const rl = await checkRateLimit('forgot-password', `email:${email}`);
  if (!rl.ok) return { ok: false, error: `Zu viele Versuche. Bitte warte ${rl.retryAfterSec}s.` };

  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(s.users.email, email) });
  // Always return ok=true to avoid user-enumeration
  if (user) {
    const { plain, hash } = generateToken();
    await db.insert(s.passwordResets).values({
      userId: user.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const link = `${appUrl()}/reset-password?token=${plain}`;
    await sendMail({ to: email, ...resetPasswordTemplate(link) });
  }
  return { ok: true };
}

export async function resetPassword(formData: FormData): Promise<Result> {
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  if (password.length < 8) return { ok: false, error: 'Passwort muss mindestens 8 Zeichen haben.' };

  const db = getDb();
  const hash = hashToken(token);
  const row = await db.query.passwordResets.findFirst({
    where: and(
      eq(s.passwordResets.tokenHash, hash),
      isNull(s.passwordResets.consumedAt),
      gt(s.passwordResets.expiresAt, new Date())
    ),
  });
  if (!row) return { ok: false, error: 'Ungültiger oder abgelaufener Link.' };

  const passwordHash = await hashPassword(password);
  await db.update(s.users).set({ passwordHash }).where(eq(s.users.id, row.userId));
  await db
    .update(s.passwordResets)
    .set({ consumedAt: new Date() })
    .where(eq(s.passwordResets.id, row.id));
  await invalidateAllUserSessions(row.userId);

  const info = await clientInfo();
  const { token: t, expiresAt } = await createSession(row.userId, info);
  await setSessionCookie(t, expiresAt);

  // Security mail: password just changed. Look up the user's email for
  // the To-address — the row only carries userId.
  const user = await db.query.users.findFirst({
    where: eq(s.users.id, row.userId),
    columns: { email: true },
  });
  if (user) {
    sendPasswordChangedAlert({
      email: user.email,
      ip: info.ip,
      userAgent: info.userAgent,
    });
  }

  return { ok: true };
}

// ─── Magic link ────────────────────────────────────────────────
export async function requestMagicLink(formData: FormData): Promise<Result> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  if (!emailValid(email)) return { ok: false, error: 'Ungültige E-Mail.' };
  const rl = await checkRateLimit('magic-link', `email:${email}`);
  if (!rl.ok) return { ok: false, error: `Zu viele Versuche. Bitte warte ${rl.retryAfterSec}s.` };

  const db = getDb();
  const { plain, hash } = generateToken();
  await db.insert(s.magicLinks).values({
    email,
    tokenHash: hash,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });
  const link = `${appUrl()}/magic-link/verify?token=${plain}`;
  await sendMail({ to: email, ...magicLinkTemplate(link) });
  return { ok: true };
}

export async function consumeMagicLink(token: string): Promise<Result> {
  const db = getDb();
  const hash = hashToken(token);
  const row = await db.query.magicLinks.findFirst({
    where: and(
      eq(s.magicLinks.tokenHash, hash),
      isNull(s.magicLinks.consumedAt),
      gt(s.magicLinks.expiresAt, new Date())
    ),
  });
  if (!row) return { ok: false, error: 'Ungültiger oder abgelaufener Link.' };

  await db.update(s.magicLinks).set({ consumedAt: new Date() }).where(eq(s.magicLinks.id, row.id));

  // Find or create user
  let user = await db.query.users.findFirst({ where: eq(s.users.email, row.email) });
  if (!user) {
    const id = newUserId();
    const name = row.email.split('@')[0];
    await db.insert(s.users).values({
      id,
      email: row.email,
      name,
      initials: initialsFromName(name),
      emailVerifiedAt: new Date(), // magic link clicked from inbox = verified
    });
    user = await db.query.users.findFirst({ where: eq(s.users.id, id) });
  } else if (!user.emailVerifiedAt) {
    await db.update(s.users).set({ emailVerifiedAt: new Date() }).where(eq(s.users.id, user.id));
  }
  if (!user) return { ok: false, error: 'Konto konnte nicht angelegt werden.' };

  const info = await clientInfo();
  const { token: t, expiresAt } = await createSession(user.id, info);
  await setSessionCookie(t, expiresAt);
  return { ok: true };
}
