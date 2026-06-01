// ─── Commitment extraction: shared pure types ───────────────────────
//
// No `server-only`, no DB, no AI-SDK imports — so the extraction parsing,
// the relative-date resolver, the prefilter and the eval scorer can all
// be unit-tested in a plain Node process (see eval/score.test.ts).
//
// `lib/ai/commitment-extract.ts` re-exports these for backward compat, so
// existing importers (`@/lib/ai/commitment-extract`) keep working.

export type CommitmentConfidence = 'high' | 'medium' | 'low';

/**
 * One extracted promise the USER (sender) made to the RECIPIENT.
 *
 * `quote` (source_sentence) is REQUIRED downstream: a candidate without a
 * verbatim source sentence is dropped before it can ever be persisted or
 * shown (Halluzinations-Schutz — see parseCommitmentResponse).
 */
export type CommitmentCandidate = {
  /** commitment_text — the promise in short, own words. */
  promise: string;
  /** source_sentence — the verbatim sentence proving the promise. Required. */
  quote: string;
  /** due_date — resolved ISO date, or null when no deadline was stated. */
  dueIso: string | null;
  /**
   * due_date_basis — what the deadline was derived from, e.g. "bis Freitag"
   * (resolved relative to the mail's SEND date), or null. Explainability +
   * eval signal. Currently surfaced in the dry-run/eval; not persisted.
   */
  dueBasis: string | null;
  confidence: CommitmentConfidence;
};

/** The minimal slice of a sent mail the extractor needs. */
export type MailForExtraction = {
  /** ISO date the mail was SENT — anchors relative deadlines ("bis Freitag"). */
  dateIso: string;
  to: string | null;
  subject: string | null;
  body: string;
};

/** Raw shape Claude is asked to return (before validation/normalisation). */
export type RawCommitment = {
  promise?: string;
  quote?: string;
  dueIso?: string | null;
  dueBasis?: string | null;
  confidence?: string;
};
