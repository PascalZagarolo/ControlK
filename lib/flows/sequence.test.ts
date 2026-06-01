// ─── Todo-Flows — sequence engine acceptance suite ──────────────────
//
// Run:  npm run test:flows
//
// Tests the pure, dependency-aware sequence engine (resolveFlow / orderSteps /
// reorderSteps / nextStepOrder) — the single source the list AND flow-chart
// views render from. No DB, no React: proves the active/waiting computation
// from depends_on deterministically.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveFlow, orderSteps, reorderSteps, nextStepOrder, type RawStep } from './sequence';
import { FLOW_STATUS } from './status';

const step = (p: Partial<RawStep> & { id: string }): RawStep => ({
  id: p.id,
  title: p.title ?? `Schritt ${p.id}`,
  status: p.status ?? 'offen',
  stepOrder: p.stepOrder ?? null,
  dependsOn: p.dependsOn ?? null,
});

const stateOf = (r: ReturnType<typeof resolveFlow>, id: string) =>
  r.steps.find((s) => s.id === id)!.state;

// ── Ordering ─────────────────────────────────────────────────────────

test('orderSteps: by stepOrder, nulls last, id tie-break (stable)', () => {
  const out = orderSteps([
    step({ id: 'c', stepOrder: 2 }),
    step({ id: 'a', stepOrder: 0 }),
    step({ id: 'b', stepOrder: 1 }),
    step({ id: 'z', stepOrder: null }),
  ]);
  assert.deepEqual(out.map((s) => s.id), ['a', 'b', 'c', 'z']);
});

// ── ABNAHME: Sequenz A→B→C über depends_on ───────────────────────────

test('Sequenz (explicit depends_on): A→B→C; A erledigt → B aktiv, C wartet', () => {
  const steps = [
    step({ id: 'A', stepOrder: 0, status: 'erledigt' }),
    step({ id: 'B', stepOrder: 1, status: 'offen', dependsOn: 'A' }),
    step({ id: 'C', stepOrder: 2, status: 'offen', dependsOn: 'B' }),
  ];
  const r = resolveFlow(steps);
  assert.equal(stateOf(r, 'A'), 'done');
  assert.equal(stateOf(r, 'B'), 'active'); // predecessor A done → active
  assert.equal(stateOf(r, 'C'), 'waiting'); // predecessor B still open → blocked
  assert.deepEqual(r.activeIds, ['B']);
});

test('Sequenz: B erledigt → C wird aktiv', () => {
  const r = resolveFlow([
    step({ id: 'A', stepOrder: 0, status: 'erledigt' }),
    step({ id: 'B', stepOrder: 1, status: 'erledigt', dependsOn: 'A' }),
    step({ id: 'C', stepOrder: 2, status: 'offen', dependsOn: 'B' }),
  ]);
  assert.equal(stateOf(r, 'C'), 'active');
  assert.deepEqual(r.activeIds, ['C']);
  assert.equal(r.complete, false);
});

test('Sequenz (linear, ohne explicit depends_on): identische Berechnung über stepOrder', () => {
  // No dependsOn set → linear predecessor (previous in order) is used.
  const r = resolveFlow([
    step({ id: 'A', stepOrder: 0, status: 'erledigt' }),
    step({ id: 'B', stepOrder: 1, status: 'offen' }),
    step({ id: 'C', stepOrder: 2, status: 'offen' }),
  ]);
  assert.equal(stateOf(r, 'B'), 'active');
  assert.equal(stateOf(r, 'C'), 'waiting');
});

test('erster Schritt ohne Vorgänger ist sofort aktiv', () => {
  const r = resolveFlow([
    step({ id: 'A', stepOrder: 0, status: 'offen' }),
    step({ id: 'B', stepOrder: 1, status: 'offen' }),
  ]);
  assert.equal(stateOf(r, 'A'), 'active');
  assert.equal(stateOf(r, 'B'), 'waiting');
});

test('abgebrochen zählt als done und entsperrt den Nachfolger', () => {
  const r = resolveFlow([
    step({ id: 'A', stepOrder: 0, status: 'abgebrochen' }),
    step({ id: 'B', stepOrder: 1, status: 'offen' }),
  ]);
  assert.equal(stateOf(r, 'A'), 'done');
  assert.equal(stateOf(r, 'B'), 'active');
});

test('Verzweigung (branch-ready): zwei Schritte mit erledigtem Vorgänger sind beide aktiv', () => {
  // A done; B and C both depend on A → both unblocked → both active.
  const r = resolveFlow([
    step({ id: 'A', stepOrder: 0, status: 'erledigt' }),
    step({ id: 'B', stepOrder: 1, status: 'offen', dependsOn: 'A' }),
    step({ id: 'C', stepOrder: 2, status: 'offen', dependsOn: 'A' }),
  ]);
  assert.deepEqual(r.activeIds.sort(), ['B', 'C']);
});

test('alle erledigt → complete, keine aktiven Schritte', () => {
  const r = resolveFlow([
    step({ id: 'A', stepOrder: 0, status: 'erledigt' }),
    step({ id: 'B', stepOrder: 1, status: 'erledigt' }),
  ]);
  assert.deepEqual(r.activeIds, []);
  assert.equal(r.activeId, null);
  assert.equal(r.complete, true);
});

test('leerer Flow → complete=true, keine Schritte/Kanten', () => {
  const r = resolveFlow([]);
  assert.equal(r.totalCount, 0);
  assert.equal(r.complete, true);
  assert.equal(r.activeId, null);
  assert.deepEqual(r.edges, []);
});

// ── Edges: solid (traversed) vs dashed (upcoming) ────────────────────

test('Kanten folgen dem effektiven Vorgänger; traversed = Quelle erledigt', () => {
  const r = resolveFlow([
    step({ id: 'A', stepOrder: 0, status: 'erledigt' }),
    step({ id: 'B', stepOrder: 1, status: 'offen' }),
    step({ id: 'C', stepOrder: 2, status: 'offen' }),
  ]);
  assert.deepEqual(
    r.edges.map((e) => ({ from: e.from, to: e.to, traversed: e.traversed })),
    [
      { from: 'A', to: 'B', traversed: true }, // A done → walked path (solid)
      { from: 'B', to: 'C', traversed: false }, // B open → upcoming (dashed)
    ]
  );
});

test('keine Dangling-Kanten bei veraltetem depends_on', () => {
  const r = resolveFlow([
    step({ id: 'A', stepOrder: 0 }),
    step({ id: 'B', stepOrder: 1, dependsOn: 'ghost' }), // unknown predecessor
  ]);
  // 'ghost' is unknown → falls back to linear predecessor A.
  assert.deepEqual(r.edges.map((e) => `${e.from}->${e.to}`), ['A->B']);
});

// ── Reorder ──────────────────────────────────────────────────────────

test('reorderSteps: nach oben tauscht + renormalisiert auf 0..n-1', () => {
  const steps = [
    step({ id: 'a', stepOrder: 0 }),
    step({ id: 'b', stepOrder: 1 }),
    step({ id: 'c', stepOrder: 2 }),
  ];
  assert.deepEqual(reorderSteps(steps, 'c', 'up'), [
    { id: 'a', stepOrder: 0 },
    { id: 'c', stepOrder: 1 },
    { id: 'b', stepOrder: 2 },
  ]);
});

test('reorder spiegelt sich in resolveFlow (Reihenfolge bestimmt Blockierung)', () => {
  const steps = [
    step({ id: 'a', stepOrder: 0, status: 'offen' }),
    step({ id: 'b', stepOrder: 1, status: 'offen' }),
  ];
  const reordered = reorderSteps(steps, 'b', 'up');
  const orderMap = new Map(reordered.map((r) => [r.id, r.stepOrder]));
  const next = steps.map((s) => ({ ...s, stepOrder: orderMap.get(s.id)! }));
  const r = resolveFlow(next);
  assert.deepEqual(r.steps.map((s) => s.id), ['b', 'a']);
  assert.equal(stateOf(r, 'b'), 'active'); // now first → active
  assert.equal(stateOf(r, 'a'), 'waiting');
});

test('nextStepOrder: leerer Flow → 0, sonst max+1', () => {
  assert.equal(nextStepOrder([]), 0);
  assert.equal(nextStepOrder([step({ id: 'a', stepOrder: 0 }), step({ id: 'b', stepOrder: 1 })]), 2);
});

// ── Central status tokens (shared by list + flow-chart) ──────────────

test('FLOW_STATUS: zentrale Labels + Sand/Gold nur für AKTIV', () => {
  assert.equal(FLOW_STATUS.done.label, 'ERLEDIGT');
  assert.equal(FLOW_STATUS.active.label, 'AKTIV');
  assert.equal(FLOW_STATUS.waiting.label, 'WARTET');
  // The sand/gold accent is reserved for the active step only.
  assert.equal(FLOW_STATUS.active.color, '#E8B86D');
  assert.notEqual(FLOW_STATUS.done.color, '#E8B86D');
  assert.notEqual(FLOW_STATUS.waiting.color, '#E8B86D');
  // Waiting is dimmed.
  assert.ok(FLOW_STATUS.waiting.opacity < 1);
});
