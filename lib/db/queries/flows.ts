import 'server-only';
import { and, asc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';
import { resolveFlow, type RawStep, type ResolvedFlow } from '@/lib/flows/sequence';

/**
 * Wedge-hook: a flow step linked to a customer can surface its open
 * commitment (Prompt 3 commitments table) so the flow becomes part of the
 * Zusagen-system, not an isolated diagram. Keyed by step todo id.
 */
export type FlowStepCommitment = {
  stepId: string;
  /** "Zusage an Müller, fällig Fr" — already formatted for the node. */
  label: string;
  customerId: string | null;
};

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
  /** Wedge-hook indicators keyed by step id (empty when none linked). */
  commitments: Record<string, FlowStepCommitment>;
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
      customerId: s.todos.customerId,
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
    commitments: await resolveStepCommitments(workspaceId, stepRows),
  };
}

// Wedge-hook: for steps linked to a customer, find that customer's nearest
// open, high-trust commitment (Prompt 3) and format a dezent node indicator.
// CONSUMES the commitments table — no new schema. Steps without a customer
// link simply get no indicator.
async function resolveStepCommitments(
  workspaceId: string,
  steps: { id: string; customerId: string | null }[]
): Promise<Record<string, FlowStepCommitment>> {
  const linked = steps.filter((s) => s.customerId);
  if (linked.length === 0) return {};
  const db = getDb();
  const customerIds = Array.from(new Set(linked.map((s) => s.customerId!) as string[]));

  // Open commitments for these customers (hallucination-guarded: quote ≠ empty).
  const rows = await db
    .select({
      customerId: s.inboxCommitments.customerId,
      recipientName: s.inboxCommitments.recipientName,
      dueAt: s.inboxCommitments.dueAt,
      customerName: s.customers.name,
    })
    .from(s.inboxCommitments)
    .leftJoin(s.customers, eq(s.customers.id, s.inboxCommitments.customerId))
    .where(
      and(
        eq(s.inboxCommitments.workspaceId, workspaceId),
        eq(s.inboxCommitments.status, 'open'),
        inArray(s.inboxCommitments.customerId, customerIds),
        // Same hallucination guard as listOpenCommitments — a quote-less or
        // empty-quote commitment is never surfaced as a wedge indicator.
        sql`${s.inboxCommitments.sourceQuote} is not null and length(trim(${s.inboxCommitments.sourceQuote})) > 0`
      )
    )
    .orderBy(asc(s.inboxCommitments.dueAt));

  // Soonest-due commitment per customer (rows already due-asc).
  const byCustomer = new Map<string, { who: string; dueAt: string | null }>();
  for (const r of rows) {
    if (!r.customerId || byCustomer.has(r.customerId)) continue;
    byCustomer.set(r.customerId, {
      who: r.customerName ?? r.recipientName ?? 'Kunde',
      dueAt: r.dueAt ? new Date(r.dueAt).toISOString() : null,
    });
  }

  const out: Record<string, FlowStepCommitment> = {};
  for (const step of linked) {
    const c = byCustomer.get(step.customerId!);
    if (!c) continue;
    out[step.id] = {
      stepId: step.id,
      customerId: step.customerId,
      label: c.dueAt ? `Zusage an ${c.who}, fällig ${shortDue(c.dueAt)}` : `Zusage an ${c.who}`,
    };
  }
  return out;
}

function shortDue(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((d.getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
  if (days < 0) return 'überfällig';
  if (days === 0) return 'heute';
  if (days === 1) return 'morgen';
  return d.toLocaleDateString('de-DE', { weekday: 'short' });
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
