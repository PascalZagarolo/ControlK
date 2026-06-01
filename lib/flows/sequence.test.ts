// ─── Todo-Flows — sequence engine acceptance suite ──────────────────
//
// Run:  npm run test:flows
//
// Tests the pure sequence engine (resolveFlow / orderSteps / reorderSteps /
// nextStepOrder) — the single source the list AND graph views render from.
// No DB, no React: proves the "one model, two views" behaviour deterministically.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveFlow, orderSteps, reorderSteps, nextStepOrder, type RawStep } from './sequence';

const step = (p: Partial<RawStep> & { id: string }): RawStep => ({
  id: p.id,
  title: p.title ?? `Schritt ${p.id}`,
  status: p.status ?? 'offen',
  stepOrder: p.stepOrder ?? null,
  dependsOn: p.dependsOn ?? null,
});

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

// ── Active step + auto-progress ──────────────────────────────────────

test('aktiv = erster offener Schritt; vorherige done, spätere upcoming', () => {
  const r = resolveFlow([
    step({ id: 'a', stepOrder: 0, status: 'erledigt' }),
    step({ id: 'b', stepOrder: 1, status: 'offen' }),
    step({ id: 'c', stepOrder: 2, status: 'offen' }),
  ]);
  assert.equal(r.activeId, 'b');
  assert.deepEqual(r.steps.map((s) => s.state), ['done', 'active', 'upcoming']);
  assert.equal(r.doneCount, 1);
  assert.equal(r.totalCount, 3);
  assert.equal(r.complete, false);
});

test('Auto-Fortschritt: aktiven Schritt erledigen → nächster wird aktiv', () => {
  const before = resolveFlow([
    step({ id: 'a', stepOrder: 0, status: 'offen' }),
    step({ id: 'b', stepOrder: 1, status: 'offen' }),
  ]);
  assert.equal(before.activeId, 'a');

  // Simulate completing the active step (the only persisted change).
  const after = resolveFlow([
    step({ id: 'a', stepOrder: 0, status: 'erledigt' }),
    step({ id: 'b', stepOrder: 1, status: 'offen' }),
  ]);
  assert.equal(after.activeId, 'b'); // advanced automatically, no extra write
  assert.equal(after.steps.find((s) => s.id === 'b')!.state, 'active');
});

test('abgebrochen zählt als done; in_arbeit ist nicht done (kann aktiv sein)', () => {
  const r = resolveFlow([
    step({ id: 'a', stepOrder: 0, status: 'abgebrochen' }),
    step({ id: 'b', stepOrder: 1, status: 'in_arbeit' }),
    step({ id: 'c', stepOrder: 2, status: 'offen' }),
  ]);
  assert.equal(r.steps[0].state, 'done');
  assert.equal(r.activeId, 'b');
});

test('alle erledigt → complete, kein aktiver Schritt', () => {
  const r = resolveFlow([
    step({ id: 'a', stepOrder: 0, status: 'erledigt' }),
    step({ id: 'b', stepOrder: 1, status: 'erledigt' }),
  ]);
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

// ── Edges (one model, both views read these) ─────────────────────────

test('lineare Kette: Kanten verbinden aufeinanderfolgende Schritte', () => {
  const r = resolveFlow([
    step({ id: 'a', stepOrder: 0 }),
    step({ id: 'b', stepOrder: 1 }),
    step({ id: 'c', stepOrder: 2 }),
  ]);
  assert.deepEqual(r.edges, [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'c' },
  ]);
});

test('dependsOn (branch-ready) wird genutzt, wenn gesetzt — keine Dangling-Kanten', () => {
  const r = resolveFlow([
    step({ id: 'a', stepOrder: 0 }),
    step({ id: 'b', stepOrder: 1, dependsOn: 'a' }),
    step({ id: 'c', stepOrder: 2, dependsOn: 'ghost' }), // stale predecessor
  ]);
  // a→b kept; c's ghost predecessor is dropped (not in the step set).
  assert.deepEqual(r.edges, [{ from: 'a', to: 'b' }]);
});

// ── Reorder ──────────────────────────────────────────────────────────

test('reorderSteps: nach oben tauscht + renormalisiert auf 0..n-1', () => {
  const steps = [
    step({ id: 'a', stepOrder: 0 }),
    step({ id: 'b', stepOrder: 1 }),
    step({ id: 'c', stepOrder: 2 }),
  ];
  const out = reorderSteps(steps, 'c', 'up');
  assert.deepEqual(out, [
    { id: 'a', stepOrder: 0 },
    { id: 'c', stepOrder: 1 },
    { id: 'b', stepOrder: 2 },
  ]);
});

test('reorderSteps: an der Grenze ist No-Op (aber normalisiert)', () => {
  const steps = [step({ id: 'a', stepOrder: 0 }), step({ id: 'b', stepOrder: 1 })];
  const out = reorderSteps(steps, 'a', 'up');
  assert.deepEqual(out, [
    { id: 'a', stepOrder: 0 },
    { id: 'b', stepOrder: 1 },
  ]);
});

test('reorder spiegelt sich in resolveFlow (Reihenfolge = einzige Wahrheit)', () => {
  const steps = [
    step({ id: 'a', stepOrder: 0, status: 'offen' }),
    step({ id: 'b', stepOrder: 1, status: 'offen' }),
  ];
  // Move b up; apply the new order, re-resolve.
  const reordered = reorderSteps(steps, 'b', 'up');
  const orderMap = new Map(reordered.map((r) => [r.id, r.stepOrder]));
  const next = steps.map((s) => ({ ...s, stepOrder: orderMap.get(s.id)! }));
  const r = resolveFlow(next);
  assert.deepEqual(r.steps.map((s) => s.id), ['b', 'a']);
  assert.equal(r.activeId, 'b'); // the now-first step is active
});

// ── nextStepOrder (append) ───────────────────────────────────────────

test('nextStepOrder: leerer Flow → 0, sonst max+1', () => {
  assert.equal(nextStepOrder([]), 0);
  assert.equal(nextStepOrder([step({ id: 'a', stepOrder: 0 }), step({ id: 'b', stepOrder: 1 })]), 2);
});
