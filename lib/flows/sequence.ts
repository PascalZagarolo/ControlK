// ─── Todo-Flows — pure sequence engine ──────────────────────────────
//
// A Flow is a Todo marked `is_flow`; its STEPS are ordinary child Todos
// (flow_parent_id → the flow). One data model, rendered two ways (list +
// graph). This module is the pure, dependency-free core that both views and
// the tests share: given the ordered raw steps, it derives each step's
// runtime state (done / active / upcoming) and the edges between them.
//
// No `server-only`, no DB, no React — unit-testable (sequence.test.ts).

export type RawStepStatus = 'offen' | 'in_arbeit' | 'erledigt' | 'abgebrochen';

/** A step as stored: an ordinary todo with the flow ordering fields. */
export type RawStep = {
  id: string;
  title: string;
  status: RawStepStatus;
  /** Order within the flow (lower = earlier). May be null for legacy rows. */
  stepOrder: number | null;
  /** Predecessor step id — set for forward-compat with branching; linear
   *  flows can ignore it and rely on stepOrder. */
  dependsOn: string | null;
};

/** Runtime state of a step in the sequence. */
export type StepState = 'done' | 'active' | 'upcoming';

export type FlowStep = RawStep & {
  /** 1-based position in the resolved order. */
  position: number;
  state: StepState;
};

export type FlowEdge = { from: string; to: string };

export type ResolvedFlow = {
  steps: FlowStep[];
  edges: FlowEdge[];
  /** id of the single active step, or null when the flow is complete/empty. */
  activeId: string | null;
  doneCount: number;
  totalCount: number;
  /** true when every step is done (or there are no steps). */
  complete: boolean;
};

function isDone(s: RawStepStatus): boolean {
  return s === 'erledigt' || s === 'abgebrochen';
}

/**
 * Deterministic order: by stepOrder ascending; null orders sink to the end;
 * ties broken by id so the result is stable across renders/processes.
 */
export function orderSteps<T extends RawStep>(steps: T[]): T[] {
  return steps.slice().sort((a, b) => {
    const ao = a.stepOrder ?? Number.MAX_SAFE_INTEGER;
    const bo = b.stepOrder ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * Resolve raw steps into the view model.
 *
 * - "active" is COMPUTED, never stored: the first not-done step in order. So
 *   completing the active step makes the next one active automatically, with
 *   no extra write (auto-progress is a pure function of the ordering).
 * - Edges follow `dependsOn` when set (branch-ready); otherwise they connect
 *   consecutive steps in resolved order (linear default).
 */
export function resolveFlow(rawSteps: RawStep[]): ResolvedFlow {
  const ordered = orderSteps(rawSteps);
  const total = ordered.length;
  const doneCount = ordered.filter((s) => isDone(s.status)).length;

  // First not-done step (in order) is the single active one.
  const activeIndex = ordered.findIndex((s) => !isDone(s.status));
  const activeId = activeIndex >= 0 ? ordered[activeIndex].id : null;

  const steps: FlowStep[] = ordered.map((s, i) => {
    let state: StepState;
    if (isDone(s.status)) state = 'done';
    else if (s.id === activeId) state = 'active';
    else state = 'upcoming';
    return { ...s, position: i + 1, state };
  });

  // Edges: prefer explicit dependsOn (forward-compat for branching); fall
  // back to linear consecutive links. Dedup + only keep edges between known
  // steps so a stale dependsOn never produces a dangling arrow.
  const known = new Set(ordered.map((s) => s.id));
  const seen = new Set<string>();
  const edges: FlowEdge[] = [];
  const pushEdge = (from: string, to: string) => {
    if (from === to || !known.has(from) || !known.has(to)) return;
    const key = `${from}→${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ from, to });
  };

  const anyDependsOn = ordered.some((s) => s.dependsOn);
  if (anyDependsOn) {
    for (const s of ordered) if (s.dependsOn) pushEdge(s.dependsOn, s.id);
  } else {
    for (let i = 1; i < ordered.length; i++) pushEdge(ordered[i - 1].id, ordered[i].id);
  }

  return {
    steps,
    edges,
    activeId,
    doneCount,
    totalCount: total,
    complete: total > 0 ? doneCount === total : true,
  };
}

/**
 * Compute the new contiguous step orders after moving a step one slot up or
 * down within the resolved order. Returns the full id→order map to persist
 * (always renormalised to 0..n-1 so orders stay dense + comparable). Pure so
 * the reorder action and the test agree exactly.
 */
export function reorderSteps(
  rawSteps: RawStep[],
  stepId: string,
  direction: 'up' | 'down'
): { id: string; stepOrder: number }[] {
  const ordered = orderSteps(rawSteps);
  const idx = ordered.findIndex((s) => s.id === stepId);
  if (idx < 0) return ordered.map((s, i) => ({ id: s.id, stepOrder: i }));
  const swapWith = direction === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= ordered.length) {
    // No-op at the boundary — still return a normalised map.
    return ordered.map((s, i) => ({ id: s.id, stepOrder: i }));
  }
  const next = ordered.slice();
  [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
  return next.map((s, i) => ({ id: s.id, stepOrder: i }));
}

/** Next free step order to append at the end of a flow. */
export function nextStepOrder(rawSteps: RawStep[]): number {
  if (rawSteps.length === 0) return 0;
  return Math.max(...rawSteps.map((s) => s.stepOrder ?? -1)) + 1;
}
