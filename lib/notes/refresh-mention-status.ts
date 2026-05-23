import 'server-only';
import { inArray, eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { extractMentions } from './extract-mentions';

/**
 * Walks a BlockNote document, collects all @-mentions, fetches their CURRENT
 * status from the DB, and returns a new document with `props.status` patched
 * to the live values.
 *
 * Why this exists: when a user inserts `@Müller (aktiv · 12d stumm)` the
 * status is stored in the doc. Two weeks later, Müller might be inactive or
 * his customer-silent-days have grown. The pill should reflect today's
 * reality, not the day-of-insertion snapshot.
 *
 * This is server-only, runs on every /notes/[id] render. Cheap O(N) walk +
 * one DB query per entity kind.
 */
export async function refreshMentionStatus(
  workspaceId: string,
  document: unknown
): Promise<unknown> {
  if (!Array.isArray(document)) return document;
  const mentions = extractMentions(document);
  if (mentions.length === 0) return document;

  const db = getDb();

  // Group mention IDs by kind and fetch live status for each kind
  const byKind: Record<string, string[]> = {};
  for (const m of mentions) {
    (byKind[m.type] ??= []).push(m.id);
  }

  const statusMap = new Map<string, string>(); // key: "kind:id" -> status

  if (byKind.customer?.length) {
    const rows = await db.query.customers.findMany({
      where: and(
        eq(s.customers.workspaceId, workspaceId),
        inArray(s.customers.id, byKind.customer)
      ),
      columns: { id: true, status: true },
    });
    for (const r of rows) statusMap.set(`customer:${r.id}`, r.status);
  }
  if (byKind.contract?.length) {
    const rows = await db.query.contracts.findMany({
      where: and(
        eq(s.contracts.workspaceId, workspaceId),
        inArray(s.contracts.id, byKind.contract)
      ),
      columns: { id: true, status: true, endsAt: true },
    });
    for (const r of rows) {
      let status = r.status as string;
      if (r.endsAt) {
        const days = Math.ceil((new Date(r.endsAt).getTime() - Date.now()) / 86_400_000);
        if (days >= 0 && days <= 14 && status === 'aktiv') status = `${days}d → ende`;
      }
      statusMap.set(`contract:${r.id}`, status);
    }
  }
  if (byKind.vehicle?.length) {
    const rows = await db.query.vehicles.findMany({
      where: and(
        eq(s.vehicles.workspaceId, workspaceId),
        inArray(s.vehicles.id, byKind.vehicle)
      ),
      columns: { id: true, status: true },
    });
    for (const r of rows) statusMap.set(`vehicle:${r.id}`, r.status);
  }
  if (byKind.todo?.length) {
    const rows = await db.query.todos.findMany({
      where: and(
        eq(s.todos.workspaceId, workspaceId),
        inArray(s.todos.id, byKind.todo)
      ),
      columns: { id: true, status: true },
    });
    for (const r of rows) statusMap.set(`todo:${r.id}`, r.status);
  }
  if (byKind.event?.length) {
    const rows = await db.query.calendarEvents.findMany({
      where: and(
        eq(s.calendarEvents.workspaceId, workspaceId),
        inArray(s.calendarEvents.id, byKind.event)
      ),
      columns: { id: true, startsAt: true },
    });
    for (const r of rows) {
      const days = Math.ceil((new Date(r.startsAt).getTime() - Date.now()) / 86_400_000);
      const lbl =
        days < 0 ? 'vergangen' : days === 0 ? 'heute' : days === 1 ? 'morgen' : `in ${days}d`;
      statusMap.set(`event:${r.id}`, lbl);
    }
  }

  // Walk the doc and patch any mention inline contents
  function patch(node: any): any {
    if (Array.isArray(node)) return node.map(patch);
    if (!node || typeof node !== 'object') return node;
    if (node.type === 'mention' && node.props?.kind && node.props?.id) {
      const key = `${node.props.kind}:${node.props.id}`;
      const liveStatus = statusMap.get(key);
      if (liveStatus !== undefined && liveStatus !== node.props.status) {
        return { ...node, props: { ...node.props, status: liveStatus } };
      }
      return node;
    }
    const out: any = { ...node };
    if (Array.isArray(node.content)) out.content = node.content.map(patch);
    if (Array.isArray(node.children)) out.children = node.children.map(patch);
    return out;
  }
  return patch(document);
}
