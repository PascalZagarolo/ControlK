// ─── Inbox noise-triage: shared types ───────────────────────────────
//
// Pure, dependency-free. NO `server-only`, NO DB imports — so the whole
// triage layer can run in a plain Node process and be unit-tested
// (see `triage.test.ts`). The Gmail/DB-coupled glue lives in
// `lib/google/classify-inbox.ts`, which calls into here.

/**
 * Why a mail is NOT answer-required. Kept richer than the DB's
 * `inbox_category` enum so the reason is explainable + testable; it is
 * mapped down to an existing inbox bucket in `inbox-mapping.ts`.
 */
export type TriageNoiseCategory =
  | 'marketing' // newsletters, promotions, sales blasts
  | 'transactional' // automated system/bounce/order mail (no human behind it)
  | 'notification' // app/service notifications (GitHub, CI/CD, social)
  | 'job_broadcast'; // freelancer.com / freelancermap mass job mails

/** `business_human` is the ONLY category that may need a reply. */
export type TriageCategory = TriageNoiseCategory | 'business_human';

/** Which rule made the call — for debugging, tests and explainability. */
export type TriageStage = 'header' | 'sender' | 'domain' | 'default';

/**
 * Raw RFC822 header values used by the deterministic header rules.
 * All optional/nullable: the rules degrade gracefully to sender- and
 * domain-based signals when a fetch layer doesn't supply headers.
 */
export type TriageHeaders = {
  listUnsubscribe?: string | null;
  listId?: string | null;
  precedence?: string | null;
  autoSubmitted?: string | null;
  returnPath?: string | null;
};

/** The minimal slice of a message the triage pipeline needs. */
export type TriageInput = {
  senderEmail: string | null;
  senderName?: string | null;
  subject?: string | null;
  headers?: TriageHeaders;
};

/**
 * Discriminated on `isNoise` so callers narrow `category` for free:
 * a noise result always carries a `TriageNoiseCategory`, a candidate
 * always carries `business_human`.
 */
export type TriageResult =
  | {
      /** true ⇒ NOT answer-required (noise). */
      isNoise: true;
      category: TriageNoiseCategory;
      stage: TriageStage;
      /** Human-readable justification, e.g. "List-Unsubscribe header present". */
      reason: string;
    }
  | {
      /** false ⇒ a reply candidate. */
      isNoise: false;
      category: 'business_human';
      stage: TriageStage;
      reason: string;
    };
