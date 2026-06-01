// ─── Stufe 2/3 — parse + validate the model's JSON (pure, testable) ──
//
// Separated from the network call so the parsing, the hallucination guard
// (drop any candidate lacking a verbatim source_sentence), the confidence
// normalisation and the relative-date repair are all unit-testable without
// a live model.

import type {
  CommitmentCandidate,
  CommitmentConfidence,
  RawCommitment,
} from './types';
import { resolveRelativeDeadline } from './relative-date';

const CONF = new Set<CommitmentConfidence>(['high', 'medium', 'low']);
const MAX_CANDIDATES = 5;

/** Best-effort JSON extraction — tolerates stray prose / markdown fences. */
export function parseModelJson(raw: string): { commitments?: RawCommitment[] } | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/^[^{[]*([{[])/s, '$1')
    .replace(/([}\]])[^}\]]*$/s, '$1');
  try {
    return JSON.parse(cleaned);
  } catch {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}

function quoteAppearsInBody(quote: string, body: string | undefined): boolean {
  if (!body) return true; // can't verify without body → don't over-reject
  const norm = (x: string) => x.toLowerCase().replace(/\s+/g, ' ').trim();
  return norm(body).includes(norm(quote).slice(0, 60));
}

/**
 * Validate + normalise the model output into safe candidates.
 *
 * Guarantees (the trust core of the feature):
 *  - A candidate with no non-empty `quote` (source_sentence) is DROPPED —
 *    never persisted, never shown (Halluzinations-Schutz).
 *  - When the mail body is provided, the quote must actually occur in it;
 *    a fabricated "verbatim" sentence is dropped too.
 *  - Confidence is clamped to high|medium|low (default 'medium' — the
 *    conservative "bitte bestätigen", never a hard "fällig" by accident).
 *  - The deadline is resolved deterministically from `dueBasis` against the
 *    SEND date; the model's own `dueIso` is only a fallback. This makes the
 *    "relative Frist relativ zum Sendedatum" behaviour provable in tests.
 *
 * On any parse failure the caller should treat the mail as "no commitment"
 * — `parseCommitmentResponse` returns [] rather than throwing.
 */
export function parseCommitmentResponse(
  raw: string,
  ctx: { sendDateIso: string; body?: string }
): CommitmentCandidate[] {
  const parsed = parseModelJson(raw);
  const list = parsed?.commitments;
  if (!Array.isArray(list)) return [];

  const out: CommitmentCandidate[] = [];
  for (const c of list) {
    const promise = (c?.promise ?? '').trim();
    const quote = (c?.quote ?? '').trim();

    // Hallucination guard: no evidence sentence → discard outright.
    if (!promise || !quote) continue;
    if (!quoteAppearsInBody(quote, ctx.body)) continue;

    const conf = (c?.confidence ?? '').toLowerCase();
    const confidence: CommitmentConfidence = CONF.has(conf as CommitmentConfidence)
      ? (conf as CommitmentConfidence)
      : 'medium';

    // Deadline: prefer deterministic resolution from the stated basis,
    // anchored to the send date; fall back to the model's ISO, validated.
    let dueIso: string | null = null;
    let dueBasis: string | null = (c?.dueBasis ?? '').trim() || null;
    const resolved = dueBasis
      ? resolveRelativeDeadline(dueBasis, ctx.sendDateIso)
      : null;
    if (resolved) {
      dueIso = resolved.iso;
      dueBasis = resolved.basis;
    } else if (c?.dueIso) {
      const d = new Date(c.dueIso);
      if (!Number.isNaN(d.getTime())) dueIso = d.toISOString();
    }

    out.push({
      promise: promise.slice(0, 400),
      quote: quote.slice(0, 600),
      dueIso,
      dueBasis,
      confidence,
    });
    if (out.length >= MAX_CANDIDATES) break;
  }
  return out;
}
