// ─── Inbox noise-triage: bridge to the existing inbox_category enum ──
//
// Keeps the triage layer decoupled from the DB/UI taxonomy while making
// the fix land WITHOUT a schema change. Noise is mapped onto inbox
// buckets the existing answer-required gate already excludes.

import type { TriageNoiseCategory } from './types';

/**
 * The buckets the morning-plan / "Auf dich wartet" gate treats as
 * answer-required. Mirrors the inline SQL clause used in
 * `lib/foyer/briefing-signals.ts` and `lib/db/queries/inbox-overview.ts`:
 *   `category in ('primary','customer')`
 * Anything mapped outside this set is, by construction, excluded from the
 * "needs a reply" surfaces.
 */
export const ANSWER_REQUIRED_CATEGORIES = ['primary', 'customer'] as const;

/**
 * Map a noise category onto an existing `inbox_category` value that the
 * answer-required gate excludes. Reuses today's enum (no migration):
 *   marketing               → promo
 *   transactional / notif.  → updates
 *   job_broadcast           → forums  (mailing-list-like)
 */
export function noiseToInboxCategory(
  category: TriageNoiseCategory
): 'promo' | 'updates' | 'forums' {
  switch (category) {
    case 'marketing':
      return 'promo';
    case 'transactional':
      return 'updates';
    case 'notification':
      return 'updates';
    case 'job_broadcast':
      return 'forums';
  }
}
