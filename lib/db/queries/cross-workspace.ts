import 'server-only';
import { and, asc, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';

const DAY_MS = 86_400_000;

export async function listWorkspaceIdsForUser(userId: string): Promise<
  { id: string; slug: string; name: string; iconEmoji?: string; from: string; to: string }[]
> {
  const db = getDb();
  const rows = await db.query.workspaceMembers.findMany({
    where: eq(s.workspaceMembers.userId, userId),
    with: { workspace: true },
  });
  return rows
    .filter((r: any) => !r.workspace.archivedAt)
    .map((r: any) => ({
      id: r.workspaceId,
      slug: r.workspace.slug,
      name: r.workspace.name,
      iconEmoji: r.workspace.iconEmoji ?? undefined,
      from: r.workspace.fromColor,
      to: r.workspace.toColor,
    }));
}

export type CrossTodoItem = {
  id: string;
  title: string;
  workspaceId: string;
  workspaceName: string;
  workspaceIconEmoji?: string;
  workspaceFrom: string;
  workspaceTo: string;
  workspaceSlug: string;
  status: string;
  priority: string;
  dueAt?: string;
};

export async function getMyTodosAcrossWorkspaces(
  userId: string,
  filter: 'today' | 'overdue' | 'mine' = 'mine'
): Promise<CrossTodoItem[]> {
  const db = getDb();
  const workspaces = await listWorkspaceIdsForUser(userId);
  if (workspaces.length === 0) return [];
  const wsMap = new Map(workspaces.map((w) => [w.id, w]));
  const wsIds = workspaces.map((w) => w.id);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + DAY_MS);

  let where: any = and(
    inArray(s.todos.workspaceId, wsIds),
    or(eq(s.todos.status, 'offen'), eq(s.todos.status, 'in_arbeit'))!,
    eq(s.todos.assigneeId, userId)
  );
  if (filter === 'today') {
    where = and(where, gte(s.todos.dueAt, todayStart), lte(s.todos.dueAt, todayEnd));
  } else if (filter === 'overdue') {
    where = and(where, lte(s.todos.dueAt, now));
  }

  const rows = await db.query.todos.findMany({
    where,
    orderBy: [
      sql`CASE WHEN ${s.todos.dueAt} IS NULL THEN 1 ELSE 0 END`,
      asc(s.todos.dueAt),
    ],
    columns: {
      id: true,
      title: true,
      workspaceId: true,
      status: true,
      priority: true,
      dueAt: true,
    },
    limit: 100,
  });

  const out: CrossTodoItem[] = [];
  for (const r of rows) {
    const ws = wsMap.get(r.workspaceId);
    if (!ws) continue;
    out.push({
      id: r.id,
      title: r.title,
      workspaceId: r.workspaceId,
      workspaceName: ws.name,
      workspaceIconEmoji: ws.iconEmoji,
      workspaceFrom: ws.from,
      workspaceTo: ws.to,
      workspaceSlug: ws.slug,
      status: r.status,
      priority: r.priority,
      dueAt: r.dueAt?.toISOString(),
    });
  }
  return out;
}

export type CrossEventItem = {
  id: string;
  title: string;
  kind: string;
  startsAt: string;
  endsAt: string;
  workspaceId: string;
  workspaceName: string;
  workspaceIconEmoji?: string;
  workspaceFrom: string;
  workspaceTo: string;
  workspaceSlug: string;
};

export async function getMyEventsAcrossWorkspaces(
  userId: string,
  daysAhead = 7
): Promise<CrossEventItem[]> {
  const db = getDb();
  const workspaces = await listWorkspaceIdsForUser(userId);
  if (workspaces.length === 0) return [];
  const wsMap = new Map(workspaces.map((w) => [w.id, w]));
  const wsIds = workspaces.map((w) => w.id);

  const now = new Date();
  const horizon = new Date(now.getTime() + daysAhead * DAY_MS);

  const rows = await db.query.calendarEvents.findMany({
    where: and(
      inArray(s.calendarEvents.workspaceId, wsIds),
      gte(s.calendarEvents.endsAt, now),
      lte(s.calendarEvents.startsAt, horizon)
    ),
    orderBy: [asc(s.calendarEvents.startsAt)],
    columns: {
      id: true,
      title: true,
      kind: true,
      startsAt: true,
      endsAt: true,
      workspaceId: true,
    },
    limit: 100,
  });

  const out: CrossEventItem[] = [];
  for (const r of rows) {
    const ws = wsMap.get(r.workspaceId);
    if (!ws) continue;
    out.push({
      id: r.id,
      title: r.title,
      kind: r.kind,
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt.toISOString(),
      workspaceId: r.workspaceId,
      workspaceName: ws.name,
      workspaceIconEmoji: ws.iconEmoji,
      workspaceFrom: ws.from,
      workspaceTo: ws.to,
      workspaceSlug: ws.slug,
    });
  }
  return out;
}
