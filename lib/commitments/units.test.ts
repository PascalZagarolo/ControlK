// ─── Commitment pipeline — unit tests for the pure cores ─────────────
//
// Run:  npm run test:commitments  (this file is included by the glob)
//
// Focused tests for the three pure modules the eval relies on:
//   relative-date.ts  · prefilter.ts · parse.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveRelativeDeadline } from './relative-date';
import { isNewsletterLike, isLowSignalSend, ownWrittenText, shouldSkipExtraction } from './prefilter';
import { parseCommitmentResponse, parseModelJson } from './parse';

// ── relative-date: anchored to the SEND date, not "today" ────────────

const MON = '2026-05-18T09:00:00.000Z'; // Monday

test('relative-date: "bis Freitag" from a Monday → that Friday', () => {
  assert.equal(resolveRelativeDeadline('bis Freitag', MON)?.iso.slice(0, 10), '2026-05-22');
});

test('relative-date: "morgen" → +1 day', () => {
  assert.equal(resolveRelativeDeadline('morgen', MON)?.iso.slice(0, 10), '2026-05-19');
});

test('relative-date: "übermorgen" → +2 days', () => {
  assert.equal(resolveRelativeDeadline('übermorgen', MON)?.iso.slice(0, 10), '2026-05-20');
});

test('relative-date: weekday already passed this week rolls to next week', () => {
  // Monday asking for "Montag" → next Monday, not today.
  assert.equal(resolveRelativeDeadline('am Montag', MON)?.iso.slice(0, 10), '2026-05-25');
});

test('relative-date: "in 3 Tagen"', () => {
  assert.equal(resolveRelativeDeadline('in 3 Tagen', MON)?.iso.slice(0, 10), '2026-05-21');
});

test('relative-date: "nächste Woche" → +7 days', () => {
  assert.equal(resolveRelativeDeadline('nächste Woche', MON)?.iso.slice(0, 10), '2026-05-25');
});

test('relative-date: explicit "bis 03.06." resolves in the send year', () => {
  assert.equal(resolveRelativeDeadline('bis 03.06.', MON)?.iso.slice(0, 10), '2026-06-03');
});

test('relative-date: "15. März" by month name', () => {
  // Already passed (May) with no year → rolls to next year.
  assert.equal(resolveRelativeDeadline('bis 15. März', MON)?.iso.slice(0, 10), '2027-03-15');
});

test('relative-date: same anchor phrase is deterministic regardless of "now"', () => {
  const a = resolveRelativeDeadline('bis Freitag', MON)?.iso;
  const b = resolveRelativeDeadline('bis Freitag', MON)?.iso;
  assert.equal(a, b);
});

test('relative-date: vague phrase → null (no fabricated date)', () => {
  assert.equal(resolveRelativeDeadline('bald', MON), null);
  assert.equal(resolveRelativeDeadline('demnächst', MON), null);
  assert.equal(resolveRelativeDeadline(null, MON), null);
});

// ── prefilter ────────────────────────────────────────────────────────

test('prefilter: newsletter (2+ markers) is caught', () => {
  assert.equal(
    isNewsletterLike({
      to: 'x@y.de',
      subject: 'Update',
      body: 'unsubscribe link unten · im Browser anzeigen',
    }),
    true
  );
});

test('prefilter: no-reply recipient is caught', () => {
  assert.equal(isNewsletterLike({ to: 'no-reply@x.de', subject: null, body: 'hi' }), true);
});

test('prefilter: genuine 1:1 mail is NOT a newsletter', () => {
  assert.equal(
    isNewsletterLike({
      to: 'anna@kunde.de',
      subject: 'Angebot',
      body: 'Ich schicke dir den Entwurf bis Freitag.',
    }),
    false
  );
});

test('prefilter: one-word ack is low-signal', () => {
  assert.equal(isLowSignalSend('Danke!'), true);
  assert.equal(isLowSignalSend('Ok'), true);
});

test('prefilter: a real promise is NOT low-signal', () => {
  assert.equal(isLowSignalSend('Ich sende dir die Rechnung morgen früh.'), false);
});

test('prefilter: ownWrittenText strips quoted reply + signature', () => {
  const body =
    'Klar, mache ich bis Freitag.\n--\nPascal\n\nAm 17.05. schrieb kunde@x.de:\n> alte nachricht';
  const own = ownWrittenText(body);
  assert.ok(own.includes('mache ich bis Freitag'));
  assert.ok(!own.includes('alte nachricht'));
  assert.ok(!own.includes('Pascal'));
});

test('prefilter: shouldSkipExtraction combines the rules', () => {
  assert.equal(shouldSkipExtraction({ to: 'x@y.de', subject: '', body: '' }), true);
  assert.equal(shouldSkipExtraction({ to: 'no-reply@y.de', subject: '', body: 'hallo welt hier text' }), true);
  assert.equal(
    shouldSkipExtraction({ to: 'a@kunde.de', subject: 'X', body: 'Ich liefere den Plan bis Montag.' }),
    false
  );
});

// ── parse + hallucination guard ──────────────────────────────────────

const CTX = { sendDateIso: MON, body: 'Ich schicke dir den Entwurf bis Freitag zu.' };

test('parse: drops a candidate with no quote (hallucination guard)', () => {
  const out = parseCommitmentResponse(
    JSON.stringify({ commitments: [{ promise: 'X liefern', confidence: 'high' }] }),
    CTX
  );
  assert.equal(out.length, 0);
});

test('parse: drops a quote that is not present in the body', () => {
  const out = parseCommitmentResponse(
    JSON.stringify({
      commitments: [{ promise: 'X', quote: 'Diesen Satz gibt es nicht im Text.', confidence: 'high' }],
    }),
    CTX
  );
  assert.equal(out.length, 0);
});

test('parse: keeps a valid candidate and resolves its deadline from basis', () => {
  const out = parseCommitmentResponse(
    JSON.stringify({
      commitments: [
        {
          promise: 'Entwurf schicken',
          quote: 'Ich schicke dir den Entwurf bis Freitag zu.',
          dueBasis: 'bis Freitag',
          dueIso: null,
          confidence: 'high',
        },
      ],
    }),
    CTX
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].dueIso?.slice(0, 10), '2026-05-22');
  assert.equal(out[0].dueBasis, 'bis Freitag');
  assert.equal(out[0].confidence, 'high');
});

test('parse: unknown confidence defaults to medium (never accidental high)', () => {
  const out = parseCommitmentResponse(
    JSON.stringify({
      commitments: [{ promise: 'X', quote: 'Ich schicke dir den Entwurf bis Freitag zu.', confidence: 'sehr sicher' }],
    }),
    CTX
  );
  assert.equal(out[0].confidence, 'medium');
});

test('parse: malformed JSON → [] (never throws)', () => {
  assert.deepEqual(parseCommitmentResponse('not json at all', CTX), []);
  assert.deepEqual(parseCommitmentResponse('', CTX), []);
});

test('parse: tolerates markdown fences around the JSON', () => {
  const fenced = '```json\n{"commitments":[{"promise":"P","quote":"Ich schicke dir den Entwurf bis Freitag zu.","confidence":"low"}]}\n```';
  const out = parseCommitmentResponse(fenced, CTX);
  assert.equal(out.length, 1);
  assert.equal(out[0].confidence, 'low');
});

test('parseModelJson: returns null on garbage', () => {
  assert.equal(parseModelJson('xyz'), null);
});
