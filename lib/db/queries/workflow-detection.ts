import 'server-only';
import { and, desc, eq, gte } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';

export type WorkflowSuggestion = {
  // Stable key from the normalized title sequence
  key: string;
  // Suggested name shown to the user
  name: string;
  occurrences: number;
  // Each "run" is a single cluster of todos created in close succession
  runs: {
    anchorAt: string;
    customerName?: string;
    vehiclePlate?: string;
    todoTitles: string[];
  }[];
  // Template steps the user can save with one click
  steps: {
    titleTemplate: string;
    dueOffsetMinutes: number;
  }[];
};

const WINDOW_DAYS = 90;
const CLUSTER_MAX_GAP_MS = 48 * 60 * 60 * 1000;
const MIN_CLUSTER_SIZE = 3;
const MIN_OCCURRENCES = 2;

function templateTitle(
  raw: string,
  customerName: string | null,
  vehiclePlate: string | null
): string {
  let t = raw;
  if (customerName) {
    const re = new RegExp(escape(customerName), 'gi');
    t = t.replace(re, '{kunde}');
  }
  if (vehiclePlate) {
    const re = new RegExp(escape(vehiclePlate), 'gi');
    t = t.replace(re, '{fahrzeug}');
  }
  // also strip digits to dedupe "Termin 14.06." vs "Termin 21.06."
  t = t.replace(/\b\d{1,2}\.\d{1,2}\.\d{0,4}\b/g, '{datum}');
  return t.trim();
}

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Scan the last 90 days of todos for the workspace and detect recurring
 * "I did the same N steps in a row" patterns that would benefit from being
 * captured as a Workflow template.
 *
 * Method: per (creator, customerOrVehicle), bucket todos by creation-time
 * proximity (gap <= 48h) into clusters. Normalize titles (strip customer/
 * vehicle/date specifics). Cluster-keys that recur >=2 times across different
 * anchors become suggestions.
 *
 * This is deliberately rule-based — no ML needed at this scale, and the rules
 * are easy to refine when the user complains.
 */
export async function detectWorkflowSuggestions(
  workspaceId: string
): Promise<WorkflowSuggestion[]> {
  const db = getDb();
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);

  const todos = await db.query.todos.findMany({
    where: and(
      eq(s.todos.workspaceId, workspaceId),
      gte(s.todos.createdAt, since)
    ),
    orderBy: [desc(s.todos.createdAt)],
    with: {
      customer: { columns: { id: true, name: true } },
      vehicle: { columns: { id: true, plate: true } },
    },
  });

  if (todos.length < MIN_CLUSTER_SIZE) return [];

  // Group by (creator, anchor) where anchor = customerId || vehicleId
  type Row = {
    id: string;
    createdAt: Date;
    title: string;
    createdBy: string | null;
    customerName: string | null;
    vehiclePlate: string | null;
    anchorId: string | null;
    anchorKind: 'customer' | 'vehicle' | null;
  };
  const rows: Row[] = todos.map((t: any) => ({
    id: t.id,
    createdAt: new Date(t.createdAt),
    title: t.title,
    createdBy: t.createdById ?? null,
    customerName: t.customer?.name ?? null,
    vehiclePlate: t.vehicle?.plate ?? null,
    anchorId: t.customer?.id ?? t.vehicle?.id ?? null,
    anchorKind: t.customer?.id ? 'customer' : t.vehicle?.id ? 'vehicle' : null,
  }));

  const groupKey = (r: Row) => `${r.createdBy ?? '·'}|${r.anchorKind ?? '·'}|${r.anchorId ?? '·'}`;
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    if (!r.anchorId) continue;
    const k = groupKey(r);
    const list = groups.get(k) ?? [];
    list.push(r);
    groups.set(k, list);
  }

  // Within each group, cluster by createdAt proximity
  type Cluster = { rows: Row[]; anchorAt: Date };
  const clusters: Cluster[] = [];
  for (const list of groups.values()) {
    // sort oldest first for clustering
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    let current: Row[] = [];
    let lastAt = 0;
    for (const r of list) {
      const t = r.createdAt.getTime();
      if (current.length === 0 || t - lastAt <= CLUSTER_MAX_GAP_MS) {
        current.push(r);
      } else {
        if (current.length >= MIN_CLUSTER_SIZE) {
          clusters.push({ rows: current, anchorAt: current[0].createdAt });
        }
        current = [r];
      }
      lastAt = t;
    }
    if (current.length >= MIN_CLUSTER_SIZE) {
      clusters.push({ rows: current, anchorAt: current[0].createdAt });
    }
  }

  if (clusters.length < MIN_OCCURRENCES) return [];

  // Cluster fingerprint: sequence of normalized titles (sorted alpha to be
  // robust to order — workflows could later refine to "respect order").
  function fingerprint(c: Cluster): { key: string; templates: string[] } {
    const templates = c.rows
      .map((r) => templateTitle(r.title, r.customerName, r.vehiclePlate))
      .map((t) => t.toLowerCase());
    const sorted = [...templates].sort();
    return { key: sorted.join('|'), templates };
  }

  const byKey = new Map<
    string,
    { clusters: Cluster[]; templates: string[] }
  >();
  for (const c of clusters) {
    const { key, templates } = fingerprint(c);
    const prev = byKey.get(key);
    if (prev) {
      prev.clusters.push(c);
    } else {
      byKey.set(key, { clusters: [c], templates });
    }
  }

  const suggestions: WorkflowSuggestion[] = [];
  for (const [key, { clusters: cs, templates }] of byKey.entries()) {
    if (cs.length < MIN_OCCURRENCES) continue;
    // Suggested name: use the first non-templated occurrence's "main verb"
    // heuristically — take first title from the most recent cluster.
    const recent = cs.sort((a, b) => b.anchorAt.getTime() - a.anchorAt.getTime())[0];
    const nameHint = recent.rows[0].title.slice(0, 40);
    suggestions.push({
      key,
      name: `Workflow: ${nameHint}…`,
      occurrences: cs.length,
      runs: cs.slice(0, 5).map((c) => ({
        anchorAt: c.anchorAt.toISOString(),
        customerName: c.rows[0].customerName ?? undefined,
        vehiclePlate: c.rows[0].vehiclePlate ?? undefined,
        todoTitles: c.rows.map((r) => r.title),
      })),
      steps: templates.map((t, i) => ({
        titleTemplate: t,
        dueOffsetMinutes: i * 60,
      })),
    });
  }

  // Sort: most occurrences first, then most recent
  suggestions.sort((a, b) => b.occurrences - a.occurrences);
  return suggestions.slice(0, 8);
}
