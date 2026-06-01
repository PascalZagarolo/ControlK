import 'server-only';
import { and, asc, eq, isNotNull } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';
import { resolveFlow, type RawStep, type ResolvedFlow } from '@/lib/flows/sequence';

export type FlowSummary = {
  id: string;
  title: string;
  description: string | null;
  groupId: string | null;
  doneCount: number;
  totalCount: number;
  complete: boolean;
  /** Title of the active step, for the overview card. */
  activeStepTitle: string | null;
};

export type FlowDetail = {
  id: string;
  title: string;
  description: string | null;
  groupId: string | null;
  resolved: ResolvedFlow;
};

// Raw step projection → the pure engine's RawStep shape.
function toRawStep(row: {
  id: string;
  title: string;
  status: 'offen' | 'in_arbeit' | 'erledigt' | 'abgebrochen';
  stepOrder: number | null;
  dependsOn: string | null;
}): RawStep {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    stepOrder: row.stepOrder,
    dependsOn: row.dependsOn,
  };
}

/** Load one flow (a todo with is_flow) + its steps, resolved for rendering. */
export async function getFlow(
  workspaceId: string,
  flowId: string
): Promise<FlowDetail | null> {
  const db = getDb();
  const flow = await db.query.todos.findFirst({
    where: and(eq(s.todos.id, flowId), eq(s.todos.workspaceId, workspaceId), eq(s.todos.isFlow, true)),
    columns: { id: true, title: true, description: true, groupId: true },
  });
  if (!flow) return null;

  const stepRows = await db
    .select({
      id: s.todos.id,
      title: s.todos.title,
      status: s.todos.status,
      stepOrder: s.todos.stepOrder,
      dependsOn: s.todos.dependsOn,
    })
    .from(s.todos)
    .where(and(eq(s.todos.workspaceId, workspaceId), eq(s.todos.flowParentId, flowId)))
    .orderBy(asc(s.todos.stepOrder));

  return {
    id: flow.id,
    title: flow.title,
    description: flow.description ?? null,
    groupId: flow.groupId ?? null,
    resolved: resolveFlow(stepRows.map(toRawStep)),
  };
}

/** Raw steps of a flow (for actions that need to recompute ordering). */
export async function getFlowSteps(workspaceId: string, flowId: string): Promise<RawStep[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: s.todos.id,
      title: s.todos.title,
      status: s.todos.status,
      stepOrder: s.todos.stepOrder,
      dependsOn: s.todos.dependsOn,
    })
    .from(s.todos)
    .where(and(eq(s.todos.workspaceId, workspaceId), eq(s.todos.flowParentId, flowId)))
    .orderBy(asc(s.todos.stepOrder));
  return rows.map(toRawStep);
}

/** All flows in a workspace (for a flows overview / picker). */
export async function listFlows(workspaceId: string): Promise<FlowSummary[]> {
  const db = getDb();
  const flows = await db
    .select({
      id: s.todos.id,
      title: s.todos.title,
      description: s.todos.description,
      groupId: s.todos.groupId,
    })
    .from(s.todos)
    .where(and(eq(s.todos.workspaceId, workspaceId), eq(s.todos.isFlow, true)))
    .orderBy(asc(s.todos.createdAt));
  if (flows.length === 0) return [];

  // One query for all steps across these flows, then bucket + resolve in code.
  const stepRows = await db
    .select({
      id: s.todos.id,
      title: s.todos.title,
      status: s.todos.status,
      stepOrder: s.todos.stepOrder,
      dependsOn: s.todos.dependsOn,
      flowParentId: s.todos.flowParentId,
    })
    .from(s.todos)
    .where(and(eq(s.todos.workspaceId, workspaceId), isNotNull(s.todos.flowParentId)));

  const byFlow = new Map<string, RawStep[]>();
  for (const r of stepRows) {
    if (!r.flowParentId) continue;
    const list = byFlow.get(r.flowParentId) ?? [];
    list.push(toRawStep(r));
    byFlow.set(r.flowParentId, list);
  }

  return flows.map((f) => {
    const resolved = resolveFlow(byFlow.get(f.id) ?? []);
    const active = resolved.steps.find((st) => st.state === 'active');
    return {
      id: f.id,
      title: f.title,
      description: f.description ?? null,
      groupId: f.groupId ?? null,
      doneCount: resolved.doneCount,
      totalCount: resolved.totalCount,
      complete: resolved.complete,
      activeStepTitle: active?.title ?? null,
    };
  });
}
