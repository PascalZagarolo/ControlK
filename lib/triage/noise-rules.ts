// ─── Inbox noise-triage: rule data ──────────────────────────────────
//
// Single source of truth for the configurable lists. Header signals
// (see `classify.ts`) are the robust, provider-agnostic backbone; the
// localpart patterns are nearly as strong; the domain lists are a
// SUPPLEMENT — a starting point seeded from real misclassifications,
// NOT a replacement for the header rules.

import type { TriageNoiseCategory } from './types';

/**
 * Sender localparts (the bit before `@`, sub-addressing after `+`
 * stripped) that are, by convention, machines you cannot reply to.
 * Matched case-insensitively. Far more reliable than any domain list —
 * `notifications@github.com`, `no-reply@asos.com`, `mailer-daemon@…`
 * all carry their nature in the localpart regardless of domain.
 */
export const NOISE_LOCALPART_PATTERNS: {
  re: RegExp;
  category: TriageNoiseCategory;
}[] = [
  { re: /^no[._-]?reply$/, category: 'notification' },
  { re: /^do[._-]?not[._-]?reply$/, category: 'notification' },
  { re: /^donotreply$/, category: 'notification' },
  { re: /^notifications?$/, category: 'notification' },
  { re: /^automated?$/, category: 'notification' },
  { re: /^auto[._-]?(confirm|reply|responder|response)$/, category: 'notification' },
  { re: /^mailer(-daemon)?$/, category: 'transactional' },
  { re: /^bounce[sd]?$/, category: 'transactional' },
  { re: /^postmaster$/, category: 'transactional' },
];

// Localpart prefixes for the variants the patterns above can't enumerate
// (e.g. `bounce-12345@`, `mailer-daemon+x@`). Checked after the patterns.
export const NOISE_LOCALPART_PREFIXES: {
  prefix: string;
  category: TriageNoiseCategory;
}[] = [
  { prefix: 'bounce', category: 'transactional' },
  { prefix: 'mailer-daemon', category: 'transactional' },
];

// A domain matches when it equals an entry OR is a sub-domain of one
// (`endsWith('.' + entry)`), so `newsletter.chrono24.com` matches
// `chrono24.com`.
//
// Deliberately small + curated. Long dictionaries rot fast and, more
// importantly, risk hiding a real human who happens to use a listed
// domain. Anything not here still gets caught by the header/localpart
// rules when it's genuinely bulk.

export const MARKETING_DOMAINS: string[] = [
  'chrono24.com',
  'chrono24.de',
  'asos.com',
  'asos.de',
  'temu.com',
  'mydealz.de',
  'lieferando.de',
  'rewe.de',
  'producthunt.com',
  'resend.com',
  'resend.dev',
  'bitly.com',
  'bit.ly',
];

export const NOTIFICATION_DOMAINS: string[] = [
  // Platform/product blasts and social notifications. (GitHub is handled
  // by the localpart rule — `notifications@github.com` — so the whole
  // github.com domain is intentionally NOT listed, to never hide a real
  // person mailing from github.com.)
  'xing.com',
  'vercel.com',
];

export const JOB_BROADCAST_DOMAINS: string[] = [
  'freelancer.com',
  'freelancermap.com',
  'freelance.de',
];

// NOTE — payment providers (paypal, klarna, stripe …) are intentionally
// absent. Their marketing carries List-Unsubscribe (→ caught by the
// header rule) while their transactional mail (a dispute, a chargeback)
// can be genuinely actionable. Blanket-blocking the domain would risk
// hiding the latter, so we let headers decide per-message instead.
