import 'server-only';
import { and, asc, count, desc, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';
import { getGroupHealthBatch } from './group-health';
import type { TodoGroup } from '@/lib/types';

function toGroup(row: any, counts?: { open: number; total: number }): TodoGroup {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    emoji: row.emoji ?? undefined,
    color: row.color ?? undefined,
    position: row.position,
    pinned: row.pinned === 1,
    archived: !!row.archivedAt,
    openCount: counts?.open ?? 0,
    totalCount: counts?.total ?? 0,
    defaultAssigneeId: row.defaultAssigneeId ?? undefined,
    defaultPriority: row.defaultPriority ?? undefined,
    defaultVisibility: row.defaultVisibility ?? undefined,
  };
}

export async function listTodoGroups(
  workspaceId: string,
  includeArchived = false
): Promise<TodoGroup[]> {
  const db = getDb();
  const rows = await db.query.todoGroups.findMany({
    where: includeArchived
      ? eq(s.todoGroups.workspaceId, workspaceId)
      : and(eq(s.todoGroups.workspaceId, workspaceId), isNull(s.todoGroups.archivedAt)),
    orderBy: [desc(s.todoGroups.pinned), asc(s.todoGroups.position), asc(s.todoGroups.createdAt)],
  });

  if (rows.length === 0) return [];

  const [counts, healthMap] = await Promise.all([
    db
      .select({
        groupId: s.todos.groupId,
        total: count(),
        open: sql<number>`COUNT(*) FILTER (WHERE ${s.todos.status} IN ('offen','in_arbeit'))`,
      })
      .from(s.todos)
      .where(eq(s.todos.workspaceId, workspaceId))
      .groupBy(s.todos.groupId),
    getGroupHealthBatch(workspaceId),
  ]);
  const byGroup = new Map<string, { total: number; open: number }>();
  for (const c of counts) {
    if (c.groupId) byGroup.set(c.groupId, { total: Number(c.total), open: Number(c.open) });
  }

  return rows.map((r) => {
    const g = toGroup(r, byGroup.get(r.id));
    g.health = healthMap.get(r.id);
    return g;
  });
}

export async function listArchivedTodoGroups(workspaceId: string): Promise<TodoGroup[]> {
  const db = getDb();
  const rows = await db.query.todoGroups.findMany({
    where: and(eq(s.todoGroups.workspaceId, workspaceId), isNotNull(s.todoGroups.archivedAt)),
    orderBy: [desc(s.todoGroups.archivedAt)],
  });
  return rows.map((r) => toGroup(r));
}

export async function getTodoGroupBySlug(workspaceId: string, slug: string) {
  const db = getDb();
  return db.query.todoGroups.findFirst({
    where: and(eq(s.todoGroups.workspaceId, workspaceId), eq(s.todoGroups.slug, slug)),
  });
}

export async function getTodoGroupBySlugAsType(
  workspaceId: string,
  slug: string
): Promise<TodoGroup | null> {
  const db = getDb();
  const row = await db.query.todoGroups.findFirst({
    where: and(eq(s.todoGroups.workspaceId, workspaceId), eq(s.todoGroups.slug, slug)),
  });
  if (!row) return null;
  const [c] = await db
    .select({
      total: count(),
      open: sql<number>`COUNT(*) FILTER (WHERE ${s.todos.status} IN ('offen','in_arbeit'))`,
    })
    .from(s.todos)
    .where(and(eq(s.todos.workspaceId, workspaceId), eq(s.todos.groupId, row.id)));
  return toGroup(row, { open: Number(c?.open ?? 0), total: Number(c?.total ?? 0) });
}

export async function countUngrouped(workspaceId: string, _userId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      open: sql<number>`COUNT(*) FILTER (WHERE ${s.todos.status} IN ('offen','in_arbeit'))`,
    })
    .from(s.todos)
    .where(and(eq(s.todos.workspaceId, workspaceId), isNull(s.todos.groupId)));
  return Number(row?.open ?? 0);
}

export async function smartViewCounts(workspaceId: string, userId: string) {
  const db = getDb();
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endToday = new Date(startToday.getTime() + 86_400_000);

  const [all] = await db
    .select({ n: count() })
    .from(s.todos)
    .where(
      and(
        eq(s.todos.workspaceId, workspaceId),
        or(eq(s.todos.status, 'offen'), eq(s.todos.status, 'in_arbeit'))!
      )
    );
  const [mine] = await db
    .select({ n: count() })
    .from(s.todos)
    .where(
      and(
        eq(s.todos.workspaceId, workspaceId),
        eq(s.todos.assigneeId, userId),
        or(eq(s.todos.status, 'offen'), eq(s.todos.status, 'in_arbeit'))!
      )
    );
  const [today] = await db
    .select({ n: count() })
    .from(s.todos)
    .where(
      and(
        eq(s.todos.workspaceId, workspaceId),
        sql`${s.todos.dueAt} >= ${startToday}`,
        sql`${s.todos.dueAt} < ${endToday}`,
        or(eq(s.todos.status, 'offen'), eq(s.todos.status, 'in_arbeit'))!
      )
    );
  const [overdue] = await db
    .select({ n: count() })
    .from(s.todos)
    .where(
      and(
        eq(s.todos.workspaceId, workspaceId),
        sql`${s.todos.dueAt} < ${startToday}`,
        or(eq(s.todos.status, 'offen'), eq(s.todos.status, 'in_arbeit'))!
      )
    );

  return {
    all: Number(all?.n ?? 0),
    mine: Number(mine?.n ?? 0),
    today: Number(today?.n ?? 0),
    overdue: Number(overdue?.n ?? 0),
  };
}
