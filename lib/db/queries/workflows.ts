import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';
import type { Workflow } from '@/lib/types';

function toWorkflow(row: any): Workflow {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    emoji: row.emoji ?? undefined,
    description: row.description ?? undefined,
    steps: (row.steps ?? [])
      .slice()
      .sort((a: any, b: any) => a.position - b.position)
      .map((st: any) => ({
        id: st.id,
        titleTemplate: st.titleTemplate,
        description: st.description ?? undefined,
        position: st.position,
        dueOffsetMinutes: st.dueOffsetMinutes ?? undefined,
        defaultPriority: st.defaultPriority ?? undefined,
        defaultEnergy: st.defaultEnergy ?? undefined,
      })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listWorkflows(workspaceId: string): Promise<Workflow[]> {
  const db = getDb();
  const rows = await db.query.workflows.findMany({
    where: eq(s.workflows.workspaceId, workspaceId),
    orderBy: [asc(s.workflows.name)],
    with: { steps: { orderBy: [asc(s.workflowSteps.position)] } },
  });
  return rows.map(toWorkflow);
}

export async function getWorkflow(
  workspaceId: string,
  workflowId: string
): Promise<Workflow | null> {
  const db = getDb();
  const row = await db.query.workflows.findFirst({
    where: and(eq(s.workflows.workspaceId, workspaceId), eq(s.workflows.id, workflowId)),
    with: { steps: { orderBy: [asc(s.workflowSteps.position)] } },
  });
  return row ? toWorkflow(row) : null;
}
