/**
 * Real-data eval runner — Pascals Schritt-0-Validierung an EIGENEN Daten,
 * OHNE echte Mailinhalte zu committen.
 *
 * It reads a local JSON file of YOUR exported sent mails, runs the EXACT
 * production deterministic path (prefilter → parser → guard → date-resolver)
 * over a model-response you paste alongside each mail, and prints a
 * detected/missed/false-positive report — identical scoring to the fixture
 * suite, but on your own corpus.
 *
 * WHY a model-response per mail and not a live call here?
 *   This runner stays offline + key-free so it can run anywhere. If you want
 *   LIVE model accuracy on your own mail, use the in-app harness instead:
 *   open /inbox/validate ("Schritt 0 · Wedge-Test") — it runs the real
 *   extractor against your Gmail, writes nothing to the DB, and shows
 *   precision live. This file is for a repeatable, versionable offline set.
 *
 * USAGE
 *   1. Copy the template:
 *        cp lib/commitments/eval/real-sample.example.json /tmp/my-sent.json
 *   2. Fill /tmp/my-sent.json with your mails + expectations (schema below).
 *      Keep it OUTSIDE the repo (e.g. /tmp) — it contains private mail.
 *   3. Run:
 *        COMMITMENT_EVAL_FILE=/tmp/my-sent.json npm run eval:commitments:real
 *
 * The file you point at is NEVER read from inside the repo and is git-ignored
 * by pattern (*.local.json) if you keep it here; prefer a path outside the repo.
 *
 * FILE SCHEMA (array of):
 *   {
 *     "name": "short label (no private content needed)",
 *     "sendDateIso": "2026-05-18T09:00:00.000Z",
 *     "to": "kunde@example.com" | null,
 *     "subject": "..." | null,
 *     "body": "the full sent body",
 *     "expected": [{ "match": "Entwurf", "dueDate": "2026-05-22" | null,
 *                    "confidenceIn": ["high"] }],
 *     "modelJson": "<the model's raw JSON response for this mail>" | null
 *   }
 * (Same shape as CommitmentFixture — see fixtures.ts.)
 */
import { readFileSync } from 'node:fs';
import { evaluate } from './score';
import type { CommitmentFixture } from './fixtures';

function main() {
  const path = process.env.COMMITMENT_EVAL_FILE;
  if (!path) {
    console.error(
      'Set COMMITMENT_EVAL_FILE to your exported sent-mail JSON.\n' +
        'See the header of this file and real-sample.example.json for the schema.'
    );
    process.exit(2);
  }

  let fixtures: CommitmentFixture[];
  try {
    fixtures = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`Could not read/parse ${path}:`, e instanceof Error ? e.message : e);
    process.exit(2);
    return;
  }
  if (!Array.isArray(fixtures) || fixtures.length === 0) {
    console.error('File must be a non-empty JSON array of mail fixtures.');
    process.exit(2);
  }

  const s = evaluate(fixtures);
  console.log('\n── Commitment eval (real data) ─────────────────────');
  console.log(`  file:            ${path}`);
  console.log(`  fixtures:        ${s.fixtures}`);
  console.log(`  expected total:  ${s.expectedTotal}`);
  console.log(`  detected:        ${s.detectedTotal}`);
  console.log(`  missed:          ${s.missedTotal}`);
  console.log(`  false positives: ${s.falsePosTotal}`);
  console.log(`  fixtures passed: ${s.passed}/${s.fixtures}`);
  console.log('  ───────────────────────────────────────────────────');
  for (const r of s.rows) {
    console.log(
      `  ${r.pass ? '✓' : '✗'} ${r.name}  [det ${r.detected}/${r.detected + r.missed.length}, fp ${r.falsePos.length}]`
    );
    for (const p of r.problems) console.log(`      · ${p}`);
  }
  const recall = s.expectedTotal ? Math.round((s.detectedTotal / s.expectedTotal) * 100) : 100;
  const denom = s.detectedTotal + s.falsePosTotal;
  const precision = denom ? Math.round((s.detectedTotal / denom) * 100) : 100;
  console.log(`\n  recall ≈ ${recall}%   precision ≈ ${precision}%\n`);

  process.exit(s.failed === 0 ? 0 : 1);
}

main();
