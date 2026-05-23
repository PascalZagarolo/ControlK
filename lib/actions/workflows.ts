'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { createTodo } from './todos';
import type { TodoEnergy, TodoPriority } from '@/lib/types';

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

async function uniqueSlug(workspaceId: string, base: string): Promise<string> {
  const db = getDb();
  let slug = base || 'workflow';
  let i = 1;
  while (true) {
    const existing = await db.query.workflows.findFirst({
      where: and(eq(s.workflows.workspaceId, workspaceId), eq(s.workflows.slug, slug)),
    });
    if (!existing) return slug;
    i += 1;
    slug = `${base || 'workflow'}-${i}`;
  }
}

function paths() {
  revalidatePath('/todos');
}

type StepInput = {
  titleTemplate: string;
  description?: string;
  dueOffsetMinutes?: number | null;
  defaultPriority?: TodoPriority;
  defaultEnergy?: TodoEnergy;
};

export async function createWorkflow(input: {
  name: string;
  emoji?: string;
  description?: string;
  steps: StepInput[];
}): Promise<Result<{ id: string; slug: string }>> {
  await requireUser();
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();

  const name = input.name.trim();
  if (!name) return { ok: false, error: 'Name erforderlich.' };
  const cleanSteps = input.steps
    .map((s) => ({ ...s, titleTemplate: s.titleTemplate.trim() }))
    .filter((s) => s.titleTemplate);
  if (cleanSteps.length === 0) return { ok: false, error: 'Mindestens ein Schritt nötig.' };

  const slug = await uniqueSlug(ws.id, slugify(name));
  const [row] = await db
    .insert(s.workflows)
    .values({
      workspaceId: ws.id,
      slug,
      name,
      emoji: input.emoji || null,
      description: input.description?.trim() || null,
      createdById: user.id,
    })
    .returning();

  await db.insert(s.workflowSteps).values(
    cleanSteps.map((st, i) => ({
      workflowId: row.id,
      titleTemplate: st.titleTemplate,
      description: st.description?.trim() || null,
      position: i,
      dueOffsetMinutes: st.dueOffsetMinutes ?? null,
      defaultPriority: st.defaultPriority ?? null,
      defaultEnergy: st.defaultEnergy ?? null,
    }))
  );

  paths();
  return { ok: true, id: row.id, slug };
}

export async function deleteWorkflow(workflowId: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await db.query.workflows.findFirst({
    where: and(eq(s.workflows.id, workflowId), eq(s.workflows.workspaceId, ws.id)),
  });
  if (!row) return { ok: false, error: 'Workflow nicht gefunden.' };
  await db.delete(s.workflows).where(eq(s.workflows.id, workflowId));
  paths();
  return { ok: true };
}

/**
 * Capture: Take a list of recent todo IDs, derive a template-workflow from them.
 * Heuristic for variable extraction: Customer name → {kunde}, Vehicle plate → {fahrzeug},
 * Contract title → {vertrag}. Anchor is the earliest dueAt.
 */
export async function captureWorkflowFromTodos(input: {
  todoIds: string[];
  name: string;
  emoji?: string;
  description?: string;
}): Promise<Result<{ id: string; slug: string }>> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  if (!input.todoIds.length) return { ok: false, error: 'Keine Todos ausgewählt.' };

  const rows = await db.query.todos.findMany({
    where: and(
      eq(s.todos.workspaceId, ws.id),
      inArray(s.todos.id, input.todoIds)
    ),
    with: {
      customer: { columns: { name: true } },
      contract: { columns: { title: true } },
      vehicle: { columns: { plate: true } },
    },
    orderBy: [s.todos.dueAt, s.todos.createdAt],
  });
  if (!rows.length) return { ok: false, error: 'Keine passenden Todos.' };

  const anchorTs = rows.reduce<number | null>((acc, r) => {
    const t = r.dueAt ? r.dueAt.getTime() : r.createdAt.getTime();
    return acc === null || t < acc ? t : acc;
  }, null)!;

  const steps: StepInput[] = rows.map((r) => {
    let tpl = r.title;
    if (r.customer?.name) tpl = tpl.split(r.customer.name).join('{kunde}');
    if (r.vehicle?.plate) tpl = tpl.split(r.vehicle.plate).join('{fahrzeug}');
    if (r.contract?.title) tpl = tpl.split(r.contract.title).join('{vertrag}');
    const dueTs = r.dueAt ? r.dueAt.getTime() : r.createdAt.getTime();
    const offsetMin = Math.round((dueTs - anchorTs) / 60_000);
    return {
      titleTemplate: tpl,
      dueOffsetMinutes: offsetMin,
      defaultPriority: r.priority as TodoPriority,
      defaultEnergy: (r.energy as TodoEnergy | null) ?? undefined,
    };
  });

  return createWorkflow({
    name: input.name,
    emoji: input.emoji,
    description: input.description,
    steps,
  });
}

/**
 * Replay a workflow: substitute variables and create todos.
 */
export async function replayWorkflow(input: {
  workflowId: string;
  variables: Record<string, string>;
  anchorIso?: string;
  groupId?: string | null;
  assigneeId?: string | null;
  customerId?: string | null;
  contractId?: string | null;
  vehicleId?: string | null;
  channelId?: string | null;
}): Promise<Result<{ created: number }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();

  const wf = await db.query.workflows.findFirst({
    where: and(eq(s.workflows.id, input.workflowId), eq(s.workflows.workspaceId, ws.id)),
    with: { steps: { orderBy: [s.workflowSteps.position] } },
  });
  if (!wf || wf.steps.length === 0) return { ok: false, error: 'Workflow leer.' };

  const anchor = input.anchorIso ? new Date(input.anchorIso) : new Date();
  if (Number.isNaN(anchor.getTime())) return { ok: false, error: 'Ungültiges Anker-Datum.' };

  const vars = input.variables ?? {};
  const substitute = (tpl: string) =>
    tpl.replace(/\{(\w+)\}/g, (m, key) => vars[key] ?? m);

  let created = 0;
  for (const st of wf.steps) {
    const title = substitute(st.titleTemplate);
    if (!title.trim()) continue;
    const dueAt =
      st.dueOffsetMinutes != null
        ? new Date(anchor.getTime() + st.dueOffsetMinutes * 60_000).toISOString()
        : null;
    const res = await createTodo({
      title,
      priority: st.defaultPriority ?? undefined,
      dueAt,
      groupId: input.groupId ?? null,
      assigneeId: input.assigneeId ?? null,
      customerId: input.customerId ?? null,
      contractId: input.contractId ?? null,
      vehicleId: input.vehicleId ?? null,
      channelId: input.channelId ?? null,
    });
    if (res.ok) {
      created += 1;
      if (st.defaultEnergy) {
        await db
          .update(s.todos)
          .set({ energy: st.defaultEnergy })
          .where(eq(s.todos.id, res.id));
      }
    }
  }

  paths();
  return { ok: true, created };
}
