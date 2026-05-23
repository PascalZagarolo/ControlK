'use server';

import { eq } from 'drizzle-orm';
import { authenticator } from 'otplib';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { verifyPassword } from '@/lib/auth/password';
import { checkRateLimit } from '@/lib/auth/rate-limit';

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

// Step 1: generate provisional secret + otpauth URL (NOT yet enabled)
export async function startTotpSetup(): Promise<Result<{ secret: string; otpauth: string; qrDataUrl: string }>> {
  const user = await requireUser();
  const db = getDb();

  authenticator.options = { window: 1, step: 30 };
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(user.email, 'uRent', secret);

  // store secret provisionally, but do not set enabledAt yet
  await db.update(s.users).set({ totpSecret: secret, totpEnabledAt: null }).where(eq(s.users.id, user.id));

  const QRCode = (await import('qrcode')).default;
  const qrDataUrl = await QRCode.toDataURL(otpauth, { margin: 1, scale: 5, color: { dark: '#0c0d0f', light: '#ffffff' } });

  return { ok: true, secret, otpauth, qrDataUrl };
}

// Step 2: confirm with first OTP — only now do we mark totp_enabled_at
export async function confirmTotp(code: string): Promise<Result> {
  const user = await requireUser();
  const rl = await checkRateLimit('totp-verify', `user:${user.id}`);
  if (!rl.ok) return { ok: false, error: `Zu viele Versuche. Bitte warte ${rl.retryAfterSec}s.` };

  const db = getDb();
  const row = await db.query.users.findFirst({ where: eq(s.users.id, user.id) });
  if (!row?.totpSecret) return { ok: false, error: 'Kein TOTP-Setup gestartet.' };
  const valid = authenticator.check(code.trim(), row.totpSecret);
  if (!valid) return { ok: false, error: 'Ungültiger Code.' };

  await db.update(s.users).set({ totpEnabledAt: new Date() }).where(eq(s.users.id, user.id));
  return { ok: true };
}

export async function disableTotp(formData: FormData): Promise<Result> {
  const user = await requireUser();
  const password = String(formData.get('password') ?? '');
  if (!password) return { ok: false, error: 'Passwort erforderlich.' };

  const db = getDb();
  const row = await db.query.users.findFirst({ where: eq(s.users.id, user.id) });
  if (!row?.passwordHash) return { ok: false, error: 'Kein Passwort hinterlegt.' };
  const ok = await verifyPassword(password, row.passwordHash);
  if (!ok) return { ok: false, error: 'Passwort falsch.' };

  await db
    .update(s.users)
    .set({ totpSecret: null, totpEnabledAt: null })
    .where(eq(s.users.id, user.id));
  return { ok: true };
}
