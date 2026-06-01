// ─── Commitment EVAL SUITE — the acceptance criterion ───────────────
//
// Run:  npm run test:commitments
//
// Grades the whole deterministic pipeline (prefilter → parser → guard →
// date-resolver) against fixtures with known ground truth and prints a
// detected / missed / false-positive table. The build of this feature is
// "accepted" when this suite is green: clear commitments detected with the
// right deadline, no-commitment mails produce nothing, ambiguous mails land
// medium/low (never high), and hallucinations are dropped.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FIXTURES } from './fixtures';
import { evaluate, scoreFixture } from './score';

// One assertion per fixture so failures point at the exact mail.
for (const fx of FIXTURES) {
  test(`eval: ${fx.name}`, () => {
    const r = scoreFixture(fx);
    assert.equal(
      r.pass,
      true,
      `\n  detected=${r.detected} missed=${r.missed.length} falsePos=${r.falsePos.length}` +
        (r.problems.length ? `\n  problems:\n   - ${r.problems.join('\n   - ')}` : '')
    );
  });
}

// Aggregate report + hard gates on the headline numbers.
test('eval: aggregate report (detected / missed / false-positive)', () => {
  const s = evaluate(FIXTURES);

  // Human-readable table (shown by the TAP runner on the diagnostic stream).
  const lines = [
    '',
    '  ── Commitment eval ────────────────────────────────',
    `  fixtures:        ${s.fixtures}`,
    `  expected total:  ${s.expectedTotal}`,
    `  detected:        ${s.detectedTotal}`,
    `  missed:          ${s.missedTotal}`,
    `  false positives: ${s.falsePosTotal}`,
    `  fixtures passed: ${s.passed}/${s.fixtures}`,
    '  ───────────────────────────────────────────────────',
    ...s.rows.map(
      (r) =>
        `  ${r.pass ? '✓' : '✗'} ${r.name}` +
        `  [det ${r.detected}/${r.detected + r.missed.length}, fp ${r.falsePos.length}]`
    ),
    '',
  ];
  console.log(lines.join('\n'));

  // Gates: nothing missed, zero false positives, every fixture green.
  assert.equal(s.missedTotal, 0, 'es wurden erwartete Zusagen verpasst');
  assert.equal(s.falsePosTotal, 0, 'es gab False-Positives');
  assert.equal(s.failed, 0, 'mindestens ein Fixture ist nicht grün');
});
