'use server';

import { createHash, randomBytes } from 'crypto';
import { headers } from 'next/headers';
import { and, eq, gte, sql } from 'drizzle-orm';
import { getDb, hasDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { sendMail, waitlistConfirmTemplate, appUrl } from '@/lib/email/send';

// Double Opt-In waitlist signup.
//
// DSGVO requires affirmative consent (the checkbox) PLUS confirmed
// ownership of the email (the link click) before we can store the address
// for outreach. We model that with:
//   - confirm_token: opaque 32-byte hex, used to look up the row from the
//     confirmation link. Cleared on confirmation so a leaked link can't
//     be replayed.
//   - confirmed_at: null = pending, set = ready to receive updates.
//
// Re-submissions are idempotent — submitting an email that's already on
// the list either resends the link (if still pending) or returns the
// "already confirmed" branch. We never reveal *which* of those happened
// to the caller's UI in distinguishable copy beyond the friendly hint,
// to avoid email enumeration.

export type WaitlistResult =
  | { ok: true; state: 'pending' | 'already_pending' | 'already_confirmed' }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PER_IP_PER_WINDOW = 1;
const WINDOW_MS = 5 * 60_000;
const TOKEN_TTL_MS = 7 * 24 * 60 * 60_000;

function hashIp(ip: string): string {
  return createHash('sha256').update(`ctrlk:${ip}`).digest('hex').slice(0, 32);
}

function newToken(): string {
  return randomBytes(32).toString('hex');
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    h.get('cf-connecting-ip') ||
    'unknown'
  );
}

export async function joinWaitlist(input: {
  email: string;
  consent: boolean;
  source?: string;
}): Promise<WaitlistResult> {
  const email = (input.email ?? '').trim().toLowerCase();
  if (!email) return { ok: false, error: 'Bitte gib eine E-Mail-Adresse ein.' };
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, error: 'Diese E-Mail-Adresse sieht nicht richtig aus.' };
  }
  if (!input.consent) {
    return {
      ok: false,
      error: 'Bitte stimme der Verarbeitung deiner E-Mail-Adresse zu.',
    };
  }

  if (!hasDb()) {
    return {
      ok: false,
      error: 'Waitlist ist gerade nicht erreichbar. Versuche es in ein paar Minuten erneut.',
    };
  }

  const db = getDb();
  const h = await headers();
  const ip = await clientIp();
  const ipHash = hashIp(ip);
  const userAgent = h.get('user-agent')?.slice(0, 500) ?? null;

  // Per-IP rate limit on signup attempts. Prevents trivial spam loops.
  const windowStart = new Date(Date.now() - WINDOW_MS);
  const recent = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(s.waitlistSignups)
    .where(
      and(
        eq(s.waitlistSignups.ipHash, ipHash),
        gte(s.waitlistSignups.createdAt, windowStart)
      )
    );
  if ((recent[0]?.count ?? 0) >= MAX_PER_IP_PER_WINDOW) {
    return {
      ok: false,
      error: 'Bitte ein paar Minuten warten — du hast gerade schon abgeschickt.',
    };
  }

  try {
    const existing = await db
      .select({
        id: s.waitlistSignups.id,
        confirmedAt: s.waitlistSignups.confirmedAt,
      })
      .from(s.waitlistSignups)
      .where(eq(s.waitlistSignups.email, email))
      .limit(1);

    const row = existing[0];

    if (row?.confirmedAt) {
      return { ok: true, state: 'already_confirmed' };
    }

    const token = newToken();
    const now = new Date();

    if (row) {
      // Pending row exists — refresh token + resend mail.
      await db
        .update(s.waitlistSignups)
        .set({ confirmToken: token, tokenSentAt: now })
        .where(eq(s.waitlistSignups.id, row.id));
    } else {
      await db.insert(s.waitlistSignups).values({
        email,
        source: input.source ?? null,
        ipHash,
        userAgent,
        confirmToken: token,
        tokenSentAt: now,
      });
    }

    const link = `${appUrl()}/api/waitlist/confirm?token=${token}`;
    const tpl = waitlistConfirmTemplate(link);
    const mail = await sendMail({
      to: email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    });
    if (!mail.ok) {
      console.error('[waitlist] send mail failed:', mail.error);
      return {
        ok: false,
        error: 'Bestätigungs-Mail konnte gerade nicht versendet werden. Probiere es in ein paar Minuten erneut.',
      };
    }

    return {
      ok: true,
      state: row ? 'already_pending' : 'pending',
    };
  } catch (err) {
    console.error('[waitlist] insert failed:', err);
    return {
      ok: false,
      error: 'Speichern ist gerade fehlgeschlagen. Versuche es in ein paar Minuten erneut.',
    };
  }
}

// Called by the /api/waitlist/confirm route. Kept here so the validation
// rules (token format, expiry, single-use semantics) live next to the
// signup logic instead of drifting in a route file.
export type ConfirmResult =
  | { ok: true; alreadyConfirmed: boolean }
  | { ok: false; reason: 'invalid' | 'expired' | 'error' };

export async function confirmWaitlist(token: string): Promise<ConfirmResult> {
  if (!token || !/^[a-f0-9]{32,128}$/i.test(token)) {
    return { ok: false, reason: 'invalid' };
  }
  if (!hasDb()) return { ok: false, reason: 'error' };

  const db = getDb();

  try {
    const rows = await db
      .select({
        id: s.waitlistSignups.id,
        confirmedAt: s.waitlistSignups.confirmedAt,
        tokenSentAt: s.waitlistSignups.tokenSentAt,
      })
      .from(s.waitlistSignups)
      .where(eq(s.waitlistSignups.confirmToken, token))
      .limit(1);

    const row = rows[0];
    if (!row) return { ok: false, reason: 'invalid' };

    if (row.confirmedAt) {
      // Idempotent — already confirmed earlier, still a success path.
      return { ok: true, alreadyConfirmed: true };
    }

    const sentAt = row.tokenSentAt ? new Date(row.tokenSentAt).getTime() : 0;
    if (!sentAt || Date.now() - sentAt > TOKEN_TTL_MS) {
      return { ok: false, reason: 'expired' };
    }

    await db
      .update(s.waitlistSignups)
      .set({ confirmedAt: new Date(), confirmToken: null })
      .where(eq(s.waitlistSignups.id, row.id));

    return { ok: true, alreadyConfirmed: false };
  } catch (err) {
    console.error('[waitlist] confirm failed:', err);
    return { ok: false, reason: 'error' };
  }
}
