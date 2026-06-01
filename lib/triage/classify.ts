// ─── Inbox noise-triage: the pipeline ───────────────────────────────
//
// Multi-stage classifier that runs on EVERY message before it can be
// treated as "Braucht deine Antwort". Stages run in order; the first one
// that recognises the mail as noise wins and short-circuits. Only mail
// that survives all stages is a reply candidate (`business_human`).
//
//   Stage 1  — hard header signals  (List-Unsubscribe / List-Id /
//              Auto-Submitted / Precedence / empty Return-Path).
//              Deterministic, provider-agnostic, no AI. Most robust.
//   Stage 1b — sender localpart      (no-reply@, notifications@, mailer-
//              daemon@, …). Deterministic, no AI.
//   Stage 2  — supplementary domain  (curated marketing/notification/
//              job-broadcast lists). Deterministic, no AI.
//   Stage 3  — AI judgement: see note at the bottom. In this codebase the
//              answer-required decision is already deterministic, so the
//              AI stage is intentionally a no-op; the candidates this
//              function returns (`isNoise === false`) are exactly the set
//              a future AI stage would be allowed to look at.
//
// Confidence / default asymmetry: a single hard signal (e.g. a lone
// List-Unsubscribe header) is enough to call a mail noise. We accept that
// this can, rarely, exclude a real-but-bulky 1:1 mail — by design: a
// false "needs reply" alarm costs more trust than a missed reply.

import type { TriageInput, TriageNoiseCategory, TriageResult } from './types';
import {
  JOB_BROADCAST_DOMAINS,
  MARKETING_DOMAINS,
  NOISE_LOCALPART_PATTERNS,
  NOISE_LOCALPART_PREFIXES,
  NOTIFICATION_DOMAINS,
} from './noise-rules';

/** Localpart (before `@`), lowercased, sub-address (`+…`) stripped. */
export function localpartOf(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf('@');
  if (at <= 0) return null;
  const local = email.slice(0, at).toLowerCase().trim();
  if (!local) return null;
  const plus = local.indexOf('+');
  return plus > 0 ? local.slice(0, plus) : local;
}

/** Registrable-ish domain (after `@`), lowercased. */
export function triageDomainOf(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf('@');
  if (at < 0 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase().trim() || null;
}

function matchesDomain(domain: string, list: string[]): boolean {
  return list.some((d) => domain === d || domain.endsWith('.' + d));
}

function nonEmpty(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

const noise = (
  category: TriageNoiseCategory,
  stage: TriageResult['stage'],
  reason: string
): TriageResult => ({ isNoise: true, category, stage, reason });

export function triageMessage(input: TriageInput): TriageResult {
  const h = input.headers ?? {};

  // ── Stage 1: hard header signals (most robust) ──
  if (nonEmpty(h.listUnsubscribe)) {
    return noise('marketing', 'header', 'List-Unsubscribe header present');
  }
  if (nonEmpty(h.listId)) {
    return noise('marketing', 'header', 'List-Id header present');
  }
  const autoSubmitted = (h.autoSubmitted ?? '').trim().toLowerCase();
  if (autoSubmitted && autoSubmitted !== 'no') {
    return noise('notification', 'header', `Auto-Submitted: ${autoSubmitted}`);
  }
  const precedence = (h.precedence ?? '').trim().toLowerCase();
  if (precedence === 'bulk' || precedence === 'junk') {
    return noise('marketing', 'header', `Precedence: ${precedence}`);
  }
  if (precedence === 'list') {
    return noise('notification', 'header', 'Precedence: list');
  }
  if ((h.returnPath ?? '').trim() === '<>') {
    return noise('transactional', 'header', 'Empty Return-Path (bounce)');
  }

  // ── Stage 1b: sender localpart ──
  const localpart = localpartOf(input.senderEmail);
  if (localpart) {
    for (const { re, category } of NOISE_LOCALPART_PATTERNS) {
      if (re.test(localpart)) {
        return noise(category, 'sender', `Sender localpart "${localpart}"`);
      }
    }
    for (const { prefix, category } of NOISE_LOCALPART_PREFIXES) {
      if (localpart.startsWith(prefix)) {
        return noise(category, 'sender', `Sender localpart "${localpart}"`);
      }
    }
  }

  // ── Stage 2: supplementary domain lists (header rules took priority) ──
  const domain = triageDomainOf(input.senderEmail);
  if (domain) {
    if (matchesDomain(domain, MARKETING_DOMAINS)) {
      return noise('marketing', 'domain', `Marketing domain ${domain}`);
    }
    if (matchesDomain(domain, JOB_BROADCAST_DOMAINS)) {
      return noise('job_broadcast', 'domain', `Job-broadcast domain ${domain}`);
    }
    if (matchesDomain(domain, NOTIFICATION_DOMAINS)) {
      return noise('notification', 'domain', `Notification domain ${domain}`);
    }
  }

  // ── Default: genuine 1:1 / business-human mail — a reply candidate ──
  return {
    isNoise: false,
    category: 'business_human',
    stage: 'default',
    reason: 'No noise signals — treated as 1:1 correspondence',
  };
}

// ─── Stage 3 (AI) — intentionally not wired here ────────────────────
//
// The "Braucht deine Antwort" decision in this codebase is purely a
// function of `inbox_category in ('primary','customer')` (see
// briefing-signals.ts / inbox-overview.ts). No AI runs on that path, so
// there is no per-message AI cost to gate and nothing to slim down.
//
// If a future version adds an AI "does this actually expect a reply?"
// pass, it MUST run only on the candidates this pipeline lets through
// (`triageMessage(...).isNoise === false`) — never on every mail. That
// both bounds cost and keeps the deterministic noise floor intact.
