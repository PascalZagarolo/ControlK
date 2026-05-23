import 'server-only';
import { randomBytes } from 'crypto';
import { and, asc, desc, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';
import type { ShareLink, Todo } from '@/lib/types';

function toShareLink(row: any): ShareLink {
  return {
    id: row.id,
    token: row.token,
    groupId: row.groupId,
    groupName: row.group?.name ?? '',
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : undefined,
    viewCount: row.viewCount,
    lastViewedAt: row.lastViewedAt ? row.lastViewedAt.toISOString() : undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listShareLinksForGroup(
  workspaceId: string,
  groupId: string
): Promise<ShareLink[]> {
  const db = getDb();
  const rows = await db.query.shareLinks.findMany({
    where: and(eq(s.shareLinks.workspaceId, workspaceId), eq(s.shareLinks.groupId, groupId)),
    orderBy: [desc(s.shareLinks.createdAt)],
    with: { group: { columns: { name: true } } },
  });
  return rows.map(toShareLink);
}

export type ShareLinkResolved = {
  link: ShareLink;
  group: {
    id: string;
    slug: string;
    name: string;
    description?: string;
    emoji?: string;
    color?: string;
  };
  creator: { name: string; initials: string; from: string; to: string };
  todos: Todo[];
};

export async function getShareLinkByToken(token: string): Promise<ShareLinkResolved | null> {
  const db = getDb();
  const row = await db.query.shareLinks.findFirst({
    where: and(
      eq(s.shareLinks.token, token),
      or(isNull(s.shareLinks.expiresAt), gt(s.shareLinks.expiresAt, new Date()))!
    ),
    with: {
      group: true,
      createdBy: true,
    },
  });
  if (!row) return null;

  // Increment view count + last viewed
  await db
    .update(s.shareLinks)
    .set({
      viewCount: sql`${s.shareLinks.viewCount} + 1`,
      lastViewedAt: new Date(),
    })
    .where(eq(s.shareLinks.id, row.id));

  // Fetch open todos in the group
  const todoRows = await db.query.todos.findMany({
    where: and(
      eq(s.todos.workspaceId, row.workspaceId),
      eq(s.todos.groupId, row.groupId)
    ),
    orderBy: [
      sql`CASE WHEN ${s.todos.status} = 'erledigt' THEN 1 ELSE 0 END`,
      sql`CASE WHEN ${s.todos.dueAt} IS NULL THEN 1 ELSE 0 END`,
      asc(s.todos.dueAt),
      desc(s.todos.createdAt),
    ],
    with: {
      assignee: true,
      createdBy: true,
      subtasks: true,
    },
    limit: 200,
  });

  const todos: Todo[] = todoRows.map((r: any) => ({
    id: r.id,
    title: r.title,
    description: r.description ?? undefined,
    status: r.status,
    priority: r.priority,
    visibility: 'team',
    dueAt: r.dueAt ? r.dueAt.toISOString() : undefined,
    completedAt: r.completedAt ? r.completedAt.toISOString() : undefined,
    createdBy: {
      id: r.createdBy.id,
      name: r.createdBy.name,
      initials: r.createdBy.initials,
      from: r.createdBy.avatarFrom,
      to: r.createdBy.avatarTo,
    },
    assignee: r.assignee
      ? {
          id: r.assignee.id,
          name: r.assignee.name,
          initials: r.assignee.initials,
          from: r.assignee.avatarFrom,
          to: r.assignee.avatarTo,
        }
      : undefined,
    watchers: [],
    subtasks: (r.subtasks ?? [])
      .slice()
      .sort((a: any, b: any) => a.position - b.position)
      .map((st: any) => ({
        id: st.id,
        title: st.title,
        done: st.done === 1,
        position: st.position,
      })),
    comments: [],
    activity: [],
    links: {},
    commentCount: 0,
    subtaskTotal: r.subtasks?.length ?? 0,
    subtaskDone: (r.subtasks ?? []).filter((st: any) => st.done === 1).length,
    energy: r.energy ?? undefined,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return {
    link: {
      id: row.id,
      token: row.token,
      groupId: row.groupId,
      groupName: row.group.name,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : undefined,
      viewCount: row.viewCount + 1,
      lastViewedAt: new Date().toISOString(),
      createdAt: row.createdAt.toISOString(),
    },
    group: {
      id: row.group.id,
      slug: row.group.slug,
      name: row.group.name,
      description: row.group.description ?? undefined,
      emoji: row.group.emoji ?? undefined,
      color: row.group.color ?? undefined,
    },
    creator: {
      name: row.createdBy.name,
      initials: row.createdBy.initials,
      from: row.createdBy.avatarFrom,
      to: row.createdBy.avatarTo,
    },
    todos,
  };
}

export function generateShareToken(): string {
  return randomBytes(24).toString('hex');
}
