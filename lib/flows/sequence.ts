// ─── Todo-Flows — pure sequence engine (dependency-aware) ───────────
//
// A Flow is a Todo marked `is_flow`; its STEPS are ordinary child Todos
// (flow_parent_id → the flow). One data model, rendered two ways (list +
// flow-chart). This module is the pure, dependency-free core both views and
// the tests share: from the raw steps it derives each step's runtime state
// (done / active / waiting) FROM THE DEPENDENCIES and the edges between them.
//
// Sequenz-Logik (der USP):
//   - A step is ACTIVE iff it is not done AND every predecessor is done.
//   - A step is WAITING iff it is not done AND some predecessor is still open
//     (blocked — answers "was kann ich JETZT NICHT tun").
//   - Completing the active step makes the next unblocked one active — purely
//     a function of the data, no stored "active" flag, no extra write.
//
// Linear flows (the first build) use the implicit predecessor = the previous
// step in `stepOrder`. `dependsOn`, when set, overrides that — so branching
// works later without a schema change. Active/waiting is computed for BOTH.
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
  /** Explicit predecessor id. When null, the linear predecessor (previous in
   *  stepOrder) is used. Lets branching arrive later without breaking schema. */
  dependsOn: string | null;
};

/** Runtime state of a step in the sequence. */
export type StepState = 'done' | 'active' | 'waiting';

export type FlowStep = RawStep & {
  /** 1-based position in the resolved order. */
  position: number;
  state: StepState;
  /** The predecessor id actually used to compute blocking (explicit or linear). */
  effectiveDependsOn: string | null;
};

export type FlowEdge = {
  from: string;
  to: string;
  /** true when the source step is done → the path here has been walked. */
  traversed: boolean;
};

export type ResolvedFlow = {
  steps: FlowStep[];
  edges: FlowEdge[];
  /** ids of every currently-active step (≥1 with branching; 1 for linear). */
  activeIds: string[];
  /** First active step id, or null — convenience for linear flows / summaries. */
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
 * Resolve raw steps into the view model — state computed from dependencies.
 */
export function resolveFlow(rawSteps: RawStep[]): ResolvedFlow {
  const ordered = orderSteps(rawSteps);
  const total = ordered.length;
  const byId = new Map(ordered.map((s) => [s.id, s]));
  const known = new Set(ordered.map((s) => s.id));

  // Effective predecessor per step: explicit dependsOn if it points to a known
  // step, else the linear predecessor (previous in order). First step → none.
  const effectiveDep = new Map<string, string | null>();
  for (let i = 0; i < ordered.length; i++) {
    const s = ordered[i];
    const explicit = s.dependsOn && known.has(s.dependsOn) ? s.dependsOn : null;
    effectiveDep.set(s.id, explicit ?? (i > 0 ? ordered[i - 1].id : null));
  }

  // A predecessor "blocks" until it is done. With a chain of linear deps this
  // naturally yields exactly one active step; with branches, ≥1.
  const predDone = (stepId: string): boolean => {
    const dep = effectiveDep.get(stepId) ?? null;
    if (!dep) return true; // no predecessor → not blocked
    const p = byId.get(dep);
    return p ? isDone(p.status) : true;
  };

  const steps: FlowStep[] = ordered.map((s, i) => {
    let state: StepState;
    if (isDone(s.status)) state = 'done';
    else if (predDone(s.id)) state = 'active';
    else state = 'waiting';
    return { ...s, position: i + 1, state, effectiveDependsOn: effectiveDep.get(s.id) ?? null };
  });

  const activeIds = steps.filter((s) => s.state === 'active').map((s) => s.id);
  const doneCount = steps.filter((s) => s.state === 'done').length;

  // Edges follow the effective predecessor → step. An edge is "traversed" once
  // its source (the predecessor) is done. Dedup; only between known steps.
  const seen = new Set<string>();
  const edges: FlowEdge[] = [];
  for (const s of steps) {
    const from = s.effectiveDependsOn;
    if (!from || !known.has(from)) continue;
    const key = `${from}→${s.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const src = byId.get(from)!;
    edges.push({ from, to: s.id, traversed: isDone(src.status) });
  }

  return {
    steps,
    edges,
    activeIds,
    activeId: activeIds[0] ?? null,
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
