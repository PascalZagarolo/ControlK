'use server';

import { createHash } from 'crypto';
import { headers } from 'next/headers';
import { and, eq, gte, sql } from 'drizzle-orm';
import { getDb, hasDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';

export type WaitlistResult =
  | { ok: true; alreadyOnList: boolean }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PER_IP_PER_WINDOW = 1; // one signup per 5 min per IP
const WINDOW_MS = 5 * 60_000;

function hashIp(ip: string): string {
  return createHash('sha256').update(`ctrlk:${ip}`).digest('hex').slice(0, 32);
}

async function clientIp(): Promise<string> {
  const h = await headers();
  // Vercel-style headers first, then generic.
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    h.get('cf-connecting-ip') ||
    'unknown'
  );
}

export async function joinWaitlist(input: {
  email: string;
  source?: string;
}): Promise<WaitlistResult> {
  const email = (input.email ?? '').trim().toLowerCase();
  if (!email) return { ok: false, error: 'Bitte gib eine E-Mail-Adresse ein.' };
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, error: 'Diese E-Mail-Adresse sieht nicht richtig aus.' };
  }

  if (!hasDb()) {
    // Graceful degradation in environments without a DB — we still want the
    // landing to render, but the form will report a backend issue.
    return { ok: false, error: 'Waitlist ist gerade nicht erreichbar. Versuche es in ein paar Minuten erneut.' };
  }

  const db = getDb();
  const h = await headers();
  const ip = await clientIp();
  const ipHash = hashIp(ip);
  const userAgent = h.get('user-agent')?.slice(0, 500) ?? null;

  // Rate limit per IP. Counts signups from this IP-hash within the window.
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
    await db
      .insert(s.waitlistSignups)
      .values({ email, source: input.source ?? null, ipHash, userAgent })
      .onConflictDoNothing({ target: s.waitlistSignups.email });
    // We can't easily distinguish insert vs no-op from drizzle's HTTP driver
    // here without a returning() clause, so do a quick check to know whether
    // the email was already there before this call.
    const existing = await db
      .select({ id: s.waitlistSignups.id, createdAt: s.waitlistSignups.createdAt })
      .from(s.waitlistSignups)
      .where(eq(s.waitlistSignups.email, email))
      .limit(1);
    const row = existing[0];
    const alreadyOnList =
      !!row && Date.now() - new Date(row.createdAt).getTime() > 1500;
    return { ok: true, alreadyOnList };
  } catch (err) {
    console.error('[waitlist] insert failed:', err);
    return {
      ok: false,
      error: 'Speichern ist gerade fehlgeschlagen. Versuche es in ein paar Minuten erneut.',
    };
  }
}
