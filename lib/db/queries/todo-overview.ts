import 'server-only';
import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';

export type TodoOverviewGroup = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  emoji?: string;
  color?: string;
  projectId: string | null;
  projectName?: string;
  // Stats
  openCount: number;
  dueTodayCount: number;
  totalCount: number;
  // Living status — a one-liner describing the group's recent activity
  livingStatus: string;
  // Most recent updatedAt across todos in this group, drives sort + "ruht seit"
  lastActivityAt: string | null;
  // Up to 3 most-pressing items as a preview
  itemPreview: {
    id: string;
    title: string;
    status: 'offen' | 'in_arbeit' | 'erledigt' | 'abgebrochen';
    priority: 'niedrig' | 'mittel' | 'hoch' | 'urgent';
    dueAt: string | null;
  }[];
  itemPreviewMore: number; // how many MORE items beyond the preview
};

const DAY_MS = 86_400_000;

/**
 * Single overview-page query: groups + per-group aggregates + 3-item preview
 * + living-status string. Optimized so the card grid renders without
 * fan-out queries (one query for groups, one for stats, one for previews,
 * one for activity). Server-only.
 */
export async function listTodoOverviewGroups(
  workspaceId: string,
  filter: { projectId?: string | null } = {}
): Promise<TodoOverviewGroup[]> {
  const db = getDb();

  // 1. Groups + optional project name
  const groupConds = [eq(s.todoGroups.workspaceId, workspaceId), isNull(s.todoGroups.archivedAt)];
  if (filter.projectId === null) {
    groupConds.push(isNull(s.todoGroups.projectId));
  } else if (filter.projectId) {
    groupConds.push(eq(s.todoGroups.projectId, filter.projectId));
  }

  const groupRows = await db.query.todoGroups.findMany({
    where: and(...groupConds),
    orderBy: [desc(s.todoGroups.pinned), asc(s.todoGroups.position), asc(s.todoGroups.name)],
  });
  if (groupRows.length === 0) return [];

  const groupIds = groupRows.map((g) => g.id);

  // 2. Per-group stats — open, dueToday, total
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + DAY_MS);

  const statRows = await db
    .select({
      groupId: s.todos.groupId,
      totalCount: sql<number>`count(*)::int`,
      openCount: sql<number>`count(*) filter (where ${s.todos.status} in ('offen','in_arbeit'))::int`,
      dueTodayCount: sql<number>`count(*) filter (where ${s.todos.status} in ('offen','in_arbeit') and ${s.todos.dueAt} >= ${startOfToday} and ${s.todos.dueAt} < ${endOfToday})::int`,
      lastUpdatedAt: sql<Date | null>`max(${s.todos.updatedAt})`,
    })
    .from(s.todos)
    .where(and(eq(s.todos.workspaceId, workspaceId), inArray(s.todos.groupId, groupIds)))
    .groupBy(s.todos.groupId);

  const statsByGroup = new Map(statRows.map((r) => [r.groupId, r]));

  // 3. Preview items per group — up to 3, prioritize open with closest due date
  const previewRows = await db.query.todos.findMany({
    where: and(eq(s.todos.workspaceId, workspaceId), inArray(s.todos.groupId, groupIds)),
    columns: { id: true, groupId: true, title: true, status: true, priority: true, dueAt: true, updatedAt: true },
    orderBy: [
      // Open first
      sql`case when ${s.todos.status} in ('offen','in_arbeit') then 0 else 1 end`,
      // Then by dueAt (nulls last)
      sql`case when ${s.todos.dueAt} is null then 1 else 0 end`,
      asc(s.todos.dueAt),
      // Then by priority desc
      sql`case ${s.todos.priority}
            when 'urgent' then 0
            when 'hoch' then 1
            when 'mittel' then 2
            when 'niedrig' then 3
          end`,
      desc(s.todos.updatedAt),
    ],
  });

  const previewsByGroup = new Map<string, typeof previewRows>();
  for (const row of previewRows) {
    if (!row.groupId) continue;
    const list = previewsByGroup.get(row.groupId) ?? [];
    list.push(row);
    previewsByGroup.set(row.groupId, list);
  }

  // 4. Most recent activity author per group — for "Zuletzt: <name>, vor Xh"
  const activityRows = await db
    .select({
      todoId: s.todoActivity.todoId,
      actorId: s.todoActivity.actorId,
      occurredAt: s.todoActivity.createdAt,
      groupId: s.todos.groupId,
      actorName: s.users.name,
    })
    .from(s.todoActivity)
    .innerJoin(s.todos, eq(s.todos.id, s.todoActivity.todoId))
    .leftJoin(s.users, eq(s.users.id, s.todoActivity.actorId))
    .where(
      and(eq(s.todos.workspaceId, workspaceId), inArray(s.todos.groupId, groupIds))
    )
    .orderBy(desc(s.todoActivity.createdAt))
    .limit(groupIds.length * 5);

  // First (newest) activity per group
  const latestActivityByGroup = new Map<
    string,
    { actorName: string | null; occurredAt: Date }
  >();
  for (const a of activityRows) {
    if (!a.groupId) continue;
    if (!latestActivityByGroup.has(a.groupId)) {
      latestActivityByGroup.set(a.groupId, {
        actorName: a.actorName,
        occurredAt: a.occurredAt,
      });
    }
  }

  // 5. Project names lookup
  const projectIds = Array.from(
    new Set(groupRows.map((g) => g.projectId).filter((id): id is string => !!id))
  );
  const projectsById = new Map<string, string>();
  if (projectIds.length > 0) {
    const projectRows = await db.query.projects.findMany({
      where: inArray(s.projects.id, projectIds),
      columns: { id: true, name: true },
    });
    for (const p of projectRows) projectsById.set(p.id, p.name);
  }

  // 6. Compose
  return groupRows.map<TodoOverviewGroup>((g) => {
    const stats = statsByGroup.get(g.id);
    const previews = previewsByGroup.get(g.id) ?? [];
    const activity = latestActivityByGroup.get(g.id);
    const totalCount = stats?.totalCount ?? 0;
    const openCount = stats?.openCount ?? 0;
    const dueTodayCount = stats?.dueTodayCount ?? 0;
    const lastActivityAt = stats?.lastUpdatedAt ?? null;

    return {
      id: g.id,
      slug: g.slug,
      name: g.name,
      description: g.description ?? undefined,
      emoji: g.emoji ?? undefined,
      color: g.color ?? undefined,
      projectId: g.projectId ?? null,
      projectName: g.projectId ? projectsById.get(g.projectId) : undefined,
      openCount,
      dueTodayCount,
      totalCount,
      livingStatus: buildLivingStatus({
        totalCount,
        openCount,
        lastActivityAt: lastActivityAt ? new Date(lastActivityAt) : null,
        latestActor: activity?.actorName ?? null,
        latestActorAt: activity?.occurredAt ?? null,
      }),
      lastActivityAt: lastActivityAt ? new Date(lastActivityAt).toISOString() : null,
      itemPreview: previews.slice(0, 3).map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status as any,
        priority: t.priority as any,
        dueAt: t.dueAt ? new Date(t.dueAt).toISOString() : null,
      })),
      itemPreviewMore: Math.max(0, previews.length - 3),
    };
  })
  // Re-sort: most-recently-active first, then by group position
  .sort((a, b) => {
    const at = a.lastActivityAt ? Date.parse(a.lastActivityAt) : 0;
    const bt = b.lastActivityAt ? Date.parse(b.lastActivityAt) : 0;
    return bt - at;
  });
}

/**
 * Produces the one-line italic "living status" string for a group card.
 * Rules of thumb (priority order):
 *   - empty group               → "Noch keine Items"
 *   - all done                  → "Alle Items abgeschlossen — Glückwunsch"
 *   - very recent activity      → "<Name> arbeitet aktiv daran" (< 30 min)
 *   - recent activity           → "Zuletzt: <Name>, vor 2h"
 *   - stale                     → "Ruht seit 5 Tagen"
 */
function buildLivingStatus(input: {
  totalCount: number;
  openCount: number;
  lastActivityAt: Date | null;
  latestActor: string | null;
  latestActorAt: Date | null;
}): string {
  if (input.totalCount === 0) return 'Noch keine Items';
  if (input.openCount === 0) return 'Alle Items abgeschlossen — Glückwunsch';

  const sourceAt = input.latestActorAt ?? input.lastActivityAt;
  if (!sourceAt) return `${input.openCount} offene Items`;

  const minAgo = Math.floor((Date.now() - sourceAt.getTime()) / 60_000);
  const actor = input.latestActor;

  if (minAgo < 30 && actor) return `${actor} arbeitet aktiv daran`;
  if (minAgo < 60) return actor ? `Zuletzt: ${actor}, vor ${minAgo}m` : `Zuletzt aktiv vor ${minAgo}m`;
  if (minAgo < 60 * 24) {
    const h = Math.floor(minAgo / 60);
    return actor ? `Zuletzt: ${actor}, vor ${h}h` : `Zuletzt aktiv vor ${h}h`;
  }
  const d = Math.floor(minAgo / (60 * 24));
  if (d <= 14) return `Ruht seit ${d} ${d === 1 ? 'Tag' : 'Tagen'}`;
  return `Ruht seit ${Math.floor(d / 7)} Wochen`;
}
