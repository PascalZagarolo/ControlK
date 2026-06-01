'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { getFlowSteps } from '@/lib/db/queries/flows';
import { reorderSteps, nextStepOrder } from '@/lib/flows/sequence';

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

// Todo-Flows actions. A flow + its steps are ordinary todos (is_flow /
// flow_parent_id) — these helpers just maintain the ordering. No separate
// data model, no execution/automation (only the visual sequence metaphor).

async function ownedTodo(todoId: string, workspaceId: string) {
  const db = getDb();
  return db.query.todos.findFirst({
    where: and(eq(s.todos.id, todoId), eq(s.todos.workspaceId, workspaceId)),
  });
}

function paths(flowId: string) {
  revalidatePath('/todos');
  revalidatePath(`/todos/flow/${flowId}`);
}

/** Create a new Flow (a todo marked is_flow), optionally inside a group. */
export async function createFlow(input: {
  title: string;
  groupId?: string | null;
  description?: string | null;
}): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const title = input.title.trim();
  if (!title) return { ok: false, error: 'Titel erforderlich.' };

  const [row] = await db
    .insert(s.todos)
    .values({
      workspaceId: ws.id,
      createdById: user.id,
      title,
      description: input.description?.trim() || null,
      groupId: input.groupId || null,
      isFlow: true,
    })
    .returning({ id: s.todos.id });

  paths(row.id);
  return { ok: true, id: row.id };
}

/** Append a step (a child todo) to the end of a flow. */
export async function addFlowStep(flowId: string, title: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const t = title.trim();
  if (!t) return { ok: false, error: 'Titel erforderlich.' };

  const flow = await ownedTodo(flowId, ws.id);
  if (!flow || !flow.isFlow) return { ok: false, error: 'Flow nicht gefunden.' };

  const steps = await getFlowSteps(ws.id, flowId);
  const order = nextStepOrder(steps);
  // Linear default: the new step depends on the previous last step.
  const prev = steps.length ? steps[steps.length - 1].id : null;

  const [row] = await db
    .insert(s.todos)
    .values({
      workspaceId: ws.id,
      createdById: user.id,
      title: t,
      groupId: flow.groupId ?? null,
      flowParentId: flowId,
      stepOrder: order,
      dependsOn: prev,
    })
    .returning({ id: s.todos.id });

  paths(flowId);
  return { ok: true, id: row.id };
}

/** Toggle a step done/open. Active-progression is derived, not stored, so a
 *  single status flip auto-advances the active marker (see lib/flows). */
export async function toggleFlowStep(stepId: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const step = await ownedTodo(stepId, ws.id);
  if (!step || !step.flowParentId) return { ok: false, error: 'Schritt nicht gefunden.' };

  const done = step.status === 'erledigt' || step.status === 'abgebrochen';
  await db
    .update(s.todos)
    .set({
      status: done ? 'offen' : 'erledigt',
      completedAt: done ? null : new Date(),
      updatedAt: new Date(),
    })
    .where(eq(s.todos.id, stepId));

  paths(step.flowParentId);
  return { ok: true };
}

/** Rename a step or the flow itself. */
export async function renameFlowNode(todoId: string, title: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const node = await ownedTodo(todoId, ws.id);
  if (!node) return { ok: false, error: 'Nicht gefunden.' };
  const next = title.trim();
  if (!next) return { ok: false, error: 'Titel erforderlich.' };
  await db.update(s.todos).set({ title: next, updatedAt: new Date() }).where(eq(s.todos.id, todoId));
  paths(node.flowParentId ?? node.id);
  return { ok: true };
}

/** Remove a step, then renormalise the remaining steps' order + dependsOn so
 *  the linear chain stays intact (no gaps, no dangling predecessor). */
export async function removeFlowStep(stepId: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const step = await ownedTodo(stepId, ws.id);
  if (!step || !step.flowParentId) return { ok: false, error: 'Schritt nicht gefunden.' };
  const flowId = step.flowParentId;

  await db.delete(s.todos).where(eq(s.todos.id, stepId));
  await renormalise(ws.id, flowId);

  paths(flowId);
  return { ok: true };
}

/** Move a step one slot up/down. Persists the recomputed dense order. */
export async function moveFlowStep(stepId: string, direction: 'up' | 'down'): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const step = await ownedTodo(stepId, ws.id);
  if (!step || !step.flowParentId) return { ok: false, error: 'Schritt nicht gefunden.' };
  const flowId = step.flowParentId;

  const steps = await getFlowSteps(ws.id, flowId);
  const next = reorderSteps(steps, stepId, direction);
  for (const { id, stepOrder } of next) {
    await db.update(s.todos).set({ stepOrder, updatedAt: new Date() }).where(eq(s.todos.id, id));
  }
  await relinkDependsOn(ws.id, flowId);

  paths(flowId);
  return { ok: true };
}

/** Delete an entire flow (cascade removes its steps via the FK). */
export async function deleteFlow(flowId: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const flow = await ownedTodo(flowId, ws.id);
  if (!flow || !flow.isFlow) return { ok: false, error: 'Flow nicht gefunden.' };
  await db.delete(s.todos).where(eq(s.todos.id, flowId));
  revalidatePath('/todos');
  return { ok: true };
}

// Renormalise step_order to 0..n-1 and relink the linear dependsOn chain.
async function renormalise(workspaceId: string, flowId: string): Promise<void> {
  const db = getDb();
  const steps = await getFlowSteps(workspaceId, flowId); // already ordered
  for (let i = 0; i < steps.length; i++) {
    await db
      .update(s.todos)
      .set({
        stepOrder: i,
        dependsOn: i === 0 ? null : steps[i - 1].id,
        updatedAt: new Date(),
      })
      .where(eq(s.todos.id, steps[i].id));
  }
}

async function relinkDependsOn(workspaceId: string, flowId: string): Promise<void> {
  const db = getDb();
  const steps = await getFlowSteps(workspaceId, flowId); // ordered by stepOrder
  for (let i = 0; i < steps.length; i++) {
    const want = i === 0 ? null : steps[i - 1].id;
    if (steps[i].dependsOn !== want) {
      await db.update(s.todos).set({ dependsOn: want, updatedAt: new Date() }).where(eq(s.todos.id, steps[i].id));
    }
  }
}
