// ─── Morning Plan engine — acceptance test suite ────────────────────
//
// Run:  npm run test:morning-plan
//
// Tests the DETERMINISTIC prioritisation + collision logic (compute.ts) —
// NOT the LLM phrasing. `now` is injected so every scenario is stable.
//
// Required scenarios (Prompt 4 acceptance):
//   1. Kollision: commitment due today + packed morning → conflict hint
//   2. Überfällige Zusagen: two overdue → rank at the top
//   3. Ruhiger Tag: nothing → honest calm state, no invented items
//   4. Low-confidence Zusage: appears as a QUESTION, not an assertion
// Plus: hallucination guard (no source_sentence → never shown).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeMorningPlan } from './compute';
import type {
  CommitmentInput,
  EventInput,
  MorningPlanInput,
  ReplyWaitingInput,
  TodoInput,
} from './types';

const NOW = new Date('2026-05-18T08:00:00.000Z'); // a Monday morning

function commitment(p: Partial<CommitmentInput>): CommitmentInput {
  return {
    id: p.id ?? 'c1',
    promiseText: p.promiseText ?? 'Angebot schicken',
    sourceQuote: p.sourceQuote ?? 'Ich schicke dir das Angebot bis Freitag.',
    dueAt: p.dueAt ?? null,
    dueBasis: p.dueBasis ?? null,
    confidence: p.confidence ?? 'high',
    recipientName: p.recipientName ?? 'Anna Hoffmann',
    recipientEmail: p.recipientEmail ?? 'anna@kunde.de',
    customerId: p.customerId ?? null,
    customerName: p.customerName ?? null,
  };
}
function reply(p: Partial<ReplyWaitingInput>): ReplyWaitingInput {
  return {
    id: p.id ?? 'm1',
    senderName: p.senderName ?? 'Thomas Müller',
    senderEmail: p.senderEmail ?? 'thomas@firma.de',
    subject: p.subject ?? 'Anfrage',
    ageDays: p.ageDays ?? 1,
  };
}
function event(p: Partial<EventInput>): EventInput {
  return {
    id: p.id ?? 'e1',
    title: p.title ?? 'Termin',
    startsAt: p.startsAt ?? '2026-05-18T09:00:00.000Z',
    endsAt: p.endsAt ?? '2026-05-18T10:00:00.000Z',
    allDay: p.allDay ?? false,
    customerName: p.customerName ?? null,
  };
}
function todo(p: Partial<TodoInput>): TodoInput {
  return {
    id: p.id ?? 't1',
    title: p.title ?? 'Interner Task',
    dueAt: p.dueAt ?? null,
    priority: p.priority ?? 'mittel',
    overdue: p.overdue ?? false,
  };
}
function base(p: Partial<MorningPlanInput>): MorningPlanInput {
  return {
    now: NOW,
    commitments: p.commitments ?? [],
    repliesWaiting: p.repliesWaiting ?? [],
    events: p.events ?? [],
    todos: p.todos ?? [],
  };
}

const iso = (d: string) => `2026-05-${d}T12:00:00.000Z`;

// ── Scenario 1: Kollision (due today + packed morning) ───────────────

test('Szenario Kollision: heute fällige Zusage + voller Vormittag → Konflikt-Hinweis', () => {
  const plan = computeMorningPlan(
    base({
      commitments: [
        commitment({ id: 'c1', promiseText: 'Vertrag finalisieren', dueAt: iso('18'), confidence: 'high' }),
      ],
      events: [
        event({ id: 'e1', title: 'Standup', startsAt: '2026-05-18T08:30:00.000Z' }),
        event({ id: 'e2', title: 'Kundencall', startsAt: '2026-05-18T10:00:00.000Z' }),
        event({ id: 'e3', title: 'Review', startsAt: '2026-05-18T11:30:00.000Z' }),
      ],
    })
  );

  const collision = plan.collisions.find((c) => c.kind === 'due_today_vs_busy');
  assert.ok(collision, 'erwartete eine due_today_vs_busy Kollision');
  assert.match(collision!.message, /heute fällig/i);
  assert.match(collision!.message, /Termin/i);
  assert.ok(collision!.relatedKeys.includes('commitment:c1'));
});

test('Kollision wird NICHT erfunden: fällige Zusage, aber leerer Vormittag', () => {
  const plan = computeMorningPlan(
    base({
      commitments: [commitment({ id: 'c1', dueAt: iso('18'), confidence: 'high' })],
      events: [event({ id: 'e1', startsAt: '2026-05-18T16:00:00.000Z' })], // afternoon only
    })
  );
  assert.equal(plan.collisions.find((c) => c.kind === 'due_today_vs_busy'), undefined);
});

// ── Scenario 2: Überfällige Zusagen ranken oben ──────────────────────

test('Szenario überfällige Zusagen: zwei überfällige ranken ganz oben', () => {
  const plan = computeMorningPlan(
    base({
      commitments: [
        commitment({ id: 'c1', promiseText: 'Rechnung A', dueAt: iso('12'), confidence: 'high' }), // 6d overdue
        commitment({ id: 'c2', promiseText: 'Rechnung B', dueAt: iso('15'), confidence: 'high' }), // 3d overdue
      ],
      repliesWaiting: [reply({ id: 'm1', ageDays: 1 })],
      todos: [todo({ id: 't1', dueAt: iso('18'), overdue: false })],
    })
  );

  // Top two items must be the overdue commitments, older first.
  assert.equal(plan.items[0].kind, 'commitment_overdue');
  assert.equal(plan.items[1].kind, 'commitment_overdue');
  assert.equal(plan.items[0].sourceId, 'c1'); // 6d overdue outranks 3d
  assert.equal(plan.items[1].sourceId, 'c2');
  assert.equal(plan.stats.overdueCommitments, 2);

  // And the multi-overdue collision fires.
  assert.ok(plan.collisions.some((c) => c.kind === 'multiple_overdue_commitments'));
});

test('Priorität: Zusage (Mensch) rankt über internem Todo', () => {
  const plan = computeMorningPlan(
    base({
      commitments: [commitment({ id: 'c1', dueAt: iso('18'), confidence: 'high' })], // due today
      todos: [todo({ id: 't1', dueAt: iso('10'), overdue: true, priority: 'urgent' })], // overdue urgent
    })
  );
  assert.equal(plan.items[0].source, 'commitment');
  assert.equal(plan.items[0].kind, 'commitment_due_today');
});

test('Priorität: wartende Mail rankt über heutigem Termin', () => {
  const plan = computeMorningPlan(
    base({
      repliesWaiting: [reply({ id: 'm1', ageDays: 2 })],
      events: [event({ id: 'e1', startsAt: '2026-05-18T09:00:00.000Z' })],
    })
  );
  assert.equal(plan.items[0].kind, 'reply_waiting');
  assert.equal(plan.items[1].kind, 'event_today');
});

// ── Scenario 3: Ruhiger Tag ──────────────────────────────────────────

test('Szenario ruhiger Tag: nichts offen → ehrlicher Ruhezustand, KEINE Items erfunden', () => {
  const plan = computeMorningPlan(base({}));
  assert.equal(plan.items.length, 0);
  assert.equal(plan.collisions.length, 0);
  assert.equal(plan.isCalm, true);
  assert.equal(plan.stats.overdueCommitments, 0);
  assert.equal(plan.stats.repliesWaiting, 0);
});

test('Ruhiger Tag mit nur einem Termin: isCalm bleibt true, Termin wird gezeigt', () => {
  const plan = computeMorningPlan(
    base({ events: [event({ id: 'e1', startsAt: '2026-05-18T14:00:00.000Z' })] })
  );
  assert.equal(plan.isCalm, true);
  assert.equal(plan.items.length, 1);
  assert.equal(plan.items[0].kind, 'event_today');
  assert.equal(plan.collisions.length, 0);
});

// ── Scenario 4: low-confidence commitment is a QUESTION ──────────────

test('Szenario low-confidence Zusage: erscheint als Frage, nicht als Behauptung', () => {
  const plan = computeMorningPlan(
    base({
      commitments: [
        commitment({
          id: 'c1',
          promiseText: 'Sache ansehen',
          sourceQuote: 'schaue ich mir mal an und gebe Rückmeldung.',
          confidence: 'low',
          dueAt: null,
        }),
      ],
    })
  );
  const item = plan.items.find((i) => i.sourceId === 'c1')!;
  assert.equal(item.isQuestion, true);
  assert.match(item.reason, /stimmt das\?/);
  // A question offers confirm/dismiss, never asserts done as if it were a fact.
  assert.deepEqual(item.actions, ['confirm', 'dismiss']);
  assert.equal(plan.stats.questions, 1);
});

test('high-confidence Zusage ist eine Aussage, keine Frage', () => {
  const plan = computeMorningPlan(
    base({ commitments: [commitment({ id: 'c1', confidence: 'high', dueAt: iso('18') })] })
  );
  const item = plan.items[0];
  assert.equal(item.isQuestion, false);
  assert.match(item.reason, /Du hast zugesagt/);
  assert.ok(item.actions.includes('done'));
});

// ── Trust: hallucination guard ───────────────────────────────────────

test('Halluzinations-Schutz: Zusage ohne source_sentence wird NIE angezeigt', () => {
  const plan = computeMorningPlan(
    base({
      commitments: [
        commitment({ id: 'c1', sourceQuote: '', dueAt: iso('12'), confidence: 'high' }),
        commitment({ id: 'c2', sourceQuote: '   ', dueAt: iso('18'), confidence: 'high' }),
        commitment({ id: 'c3', sourceQuote: 'Echter Beleg-Satz hier.', dueAt: iso('18'), confidence: 'high' }),
      ],
    })
  );
  const ids = plan.items.map((i) => i.sourceId);
  assert.ok(!ids.includes('c1'));
  assert.ok(!ids.includes('c2'));
  assert.ok(ids.includes('c3'));
  assert.equal(plan.items.length, 1);
});

// ── Explainability: every item carries a reason + a kind ─────────────

test('Erklärbarkeit: jedes Item hat einen reason und stabilen key', () => {
  const plan = computeMorningPlan(
    base({
      commitments: [commitment({ id: 'c1', dueAt: iso('12'), confidence: 'high' })],
      repliesWaiting: [reply({ id: 'm1', ageDays: 3 })],
      events: [event({ id: 'e1' })],
      todos: [todo({ id: 't1', dueAt: iso('18') })],
    })
  );
  for (const item of plan.items) {
    assert.ok(item.reason && item.reason.length > 0, `Item ${item.key} ohne reason`);
    assert.match(item.key, /^(commitment|inbox|calendar|todo):/);
  }
  // The reply reason names the waiting and the commitment reason quotes evidence.
  const replyItem = plan.items.find((i) => i.kind === 'reply_waiting')!;
  assert.match(replyItem.reason, /Braucht deine Antwort/);
  const cItem = plan.items.find((i) => i.source === 'commitment')!;
  assert.match(cItem.reason, /„.+"/); // contains the quoted source sentence
});

// ── Collision: long-waiting customer ─────────────────────────────────

test('Kollision: Person wartet seit Tagen → customer_long_wait Hinweis', () => {
  const plan = computeMorningPlan(
    base({ repliesWaiting: [reply({ id: 'm1', senderName: 'Studio Weber', ageDays: 6 })] })
  );
  const c = plan.collisions.find((x) => x.kind === 'customer_long_wait');
  assert.ok(c);
  assert.match(c!.message, /Studio Weber/);
  assert.match(c!.message, /6 Tagen/);
});

test('Kein Long-Wait-Hinweis bei frischer Mail (< Schwelle)', () => {
  const plan = computeMorningPlan(base({ repliesWaiting: [reply({ id: 'm1', ageDays: 1 })] }));
  assert.equal(plan.collisions.find((x) => x.kind === 'customer_long_wait'), undefined);
});
