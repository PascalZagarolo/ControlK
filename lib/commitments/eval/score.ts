// ─── Commitment eval: the scorer (pure) ─────────────────────────────
//
// Runs a fixture through the EXACT production deterministic path:
//   Stufe 1 prefilter (shouldSkipExtraction)
//   → Stufe 2/3 parser + hallucination guard + date resolver (parseCommitmentResponse)
// and grades the result against the fixture's ground truth.
//
// "detected" = an expected commitment matched by a produced one.
// "missed"   = an expected commitment with no match.
// "falsePos" = a produced commitment matching no expectation.
//
// The model itself is NOT called here — `modelJson` stands in for its
// output so the suite is hermetic, free and CI-stable. Real-model accuracy
// is measured on real mail via the dry-run harness (see README).

import { shouldSkipExtraction } from '../prefilter';
import { parseCommitmentResponse } from '../parse';
import type { CommitmentCandidate } from '../types';
import type { CommitmentFixture, ExpectedCommitment } from './fixtures';

export type FixtureScore = {
  name: string;
  prefiltered: boolean;
  produced: CommitmentCandidate[];
  detected: number;
  missed: ExpectedCommitment[];
  falsePos: CommitmentCandidate[];
  /** Expected-vs-actual deadline mismatches (date wrong / confidence band off). */
  problems: string[];
  pass: boolean;
};

export type EvalSummary = {
  fixtures: number;
  expectedTotal: number;
  detectedTotal: number;
  missedTotal: number;
  falsePosTotal: number;
  passed: number;
  failed: number;
  rows: FixtureScore[];
};

function ymd(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toISOString().slice(0, 10);
}

function matches(exp: ExpectedCommitment, got: CommitmentCandidate): boolean {
  const hay = `${got.promise} ${got.quote}`.toLowerCase();
  return hay.includes(exp.match.toLowerCase());
}

export function scoreFixture(fx: CommitmentFixture): FixtureScore {
  const problems: string[] = [];

  // Stufe 1 — the real prefilter decision.
  const prefiltered = shouldSkipExtraction({ to: fx.to, subject: fx.subject, body: fx.body });

  // A fixture whose modelJson is null asserts "prefilter must drop this".
  if (fx.modelJson === null) {
    const pass = prefiltered && fx.expected.length === 0;
    if (!prefiltered) problems.push('erwartete Prefilter-Verwerfung, aber Mail ging durch');
    return {
      name: fx.name,
      prefiltered,
      produced: [],
      detected: 0,
      missed: pass ? [] : fx.expected,
      falsePos: [],
      problems,
      pass,
    };
  }

  // If the fixture has a model response but the prefilter dropped it, that's
  // a prefilter false-positive (it ate a real candidate mail).
  if (prefiltered) {
    problems.push('Prefilter hat eine Kandidaten-Mail fälschlich verworfen');
    return {
      name: fx.name,
      prefiltered,
      produced: [],
      detected: 0,
      missed: fx.expected,
      falsePos: [],
      problems,
      pass: fx.expected.length === 0,
    };
  }

  // Stufe 2/3 — real parser + guard + date resolution against the SEND date.
  const produced = parseCommitmentResponse(fx.modelJson, {
    sendDateIso: fx.sendDateIso,
    body: fx.body,
  });

  // Match expectations ↔ produced.
  const usedProduced = new Set<number>();
  const missed: ExpectedCommitment[] = [];
  let detected = 0;
  for (const exp of fx.expected) {
    const idx = produced.findIndex((p, i) => !usedProduced.has(i) && matches(exp, p));
    if (idx === -1) {
      missed.push(exp);
      continue;
    }
    usedProduced.add(idx);
    detected += 1;
    const got = produced[idx];

    // Deadline correctness (resolved relative to the SEND date).
    if (ymd(got.dueIso) !== exp.dueDate) {
      problems.push(
        `Frist falsch für "${exp.match}": erwartet ${exp.dueDate ?? 'keine'}, bekam ${ymd(got.dueIso) ?? 'keine'}`
      );
    }
    // Confidence band.
    if (!exp.confidenceIn.includes(got.confidence)) {
      problems.push(
        `Confidence "${got.confidence}" für "${exp.match}" nicht in [${exp.confidenceIn.join('|')}]`
      );
    }
  }

  const falsePos = produced.filter((_, i) => !usedProduced.has(i));
  for (const fp of falsePos) {
    problems.push(`False-Positive: "${fp.promise}"`);
  }

  const pass = missed.length === 0 && falsePos.length === 0 && problems.length === 0;
  return { name: fx.name, prefiltered, produced, detected, missed, falsePos, problems, pass };
}

export function evaluate(fixtures: CommitmentFixture[]): EvalSummary {
  const rows = fixtures.map(scoreFixture);
  return {
    fixtures: rows.length,
    expectedTotal: fixtures.reduce((n, f) => n + f.expected.length, 0),
    detectedTotal: rows.reduce((n, r) => n + r.detected, 0),
    missedTotal: rows.reduce((n, r) => n + r.missed.length, 0),
    falsePosTotal: rows.reduce((n, r) => n + r.falsePos.length, 0),
    passed: rows.filter((r) => r.pass).length,
    failed: rows.filter((r) => !r.pass).length,
    rows,
  };
}
