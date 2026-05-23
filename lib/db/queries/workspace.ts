import 'server-only';
import { and, asc, count, desc, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';
import type {
  Workspace,
  WorkspaceActivityEntry,
  WorkspaceInvite,
  WorkspaceMember,
  WorkspaceRole,
} from '@/lib/types';

function toUser(row: any) {
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    initials: row.initials,
    from: row.avatarFrom,
    to: row.avatarTo,
  };
}

function toWorkspaceLite(row: any, role?: WorkspaceRole, memberCount?: number): Workspace {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    short: row.short,
    from: row.fromColor,
    to: row.toColor,
    description: row.description ?? undefined,
    iconEmoji: row.iconEmoji ?? undefined,
    template: row.template ?? undefined,
    timezone: row.timezone ?? undefined,
    isPublic: row.isPublic === 1,
    archived: !!row.archivedAt,
    role,
    memberCount,
    ownerName: row.owner?.name,
  };
}

export async function getWorkspaceBySlug(slug: string) {
  const db = getDb();
  return db.query.workspaces.findFirst({ where: eq(s.workspaces.slug, slug) });
}

export async function listWorkspacesForUser(userId: string): Promise<Workspace[]> {
  const db = getDb();
  const memberships = await db.query.workspaceMembers.findMany({
    where: eq(s.workspaceMembers.userId, userId),
    with: {
      workspace: { with: { owner: true } },
    },
    orderBy: [asc(s.workspaceMembers.joinedAt)],
  });
  const wsIds = memberships.map((m) => m.workspaceId);
  const counts =
    wsIds.length > 0
      ? await db
          .select({
            workspaceId: s.workspaceMembers.workspaceId,
            n: count(),
          })
          .from(s.workspaceMembers)
          .where(
            sql`${s.workspaceMembers.workspaceId} = ANY(${sql.raw(
              `ARRAY[${wsIds.map((id) => `'${id}'`).join(',')}]::uuid[]`
            )})`
          )
          .groupBy(s.workspaceMembers.workspaceId)
      : [];
  const countMap = new Map<string, number>();
  for (const c of counts) countMap.set(c.workspaceId, Number(c.n));

  return memberships
    .filter((m: any) => !m.workspace.archivedAt)
    .map((m: any) =>
      toWorkspaceLite(m.workspace, m.role as WorkspaceRole, countMap.get(m.workspaceId) ?? 1)
    );
}

export async function isWorkspaceMember(workspaceId: string, userId: string) {
  const db = getDb();
  const row = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(s.workspaceMembers.workspaceId, workspaceId),
      eq(s.workspaceMembers.userId, userId)
    ),
  });
  return !!row;
}

export async function getMyRole(
  workspaceId: string,
  userId: string
): Promise<WorkspaceRole | null> {
  const db = getDb();
  const row = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(s.workspaceMembers.workspaceId, workspaceId),
      eq(s.workspaceMembers.userId, userId)
    ),
    columns: { role: true },
  });
  return (row?.role as WorkspaceRole) ?? null;
}

export async function listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const db = getDb();
  const rows = await db.query.workspaceMembers.findMany({
    where: eq(s.workspaceMembers.workspaceId, workspaceId),
    with: { user: true },
    orderBy: [asc(s.workspaceMembers.joinedAt)],
  });
  return rows.map((r: any) => ({
    userId: r.userId,
    name: r.user.name,
    email: r.user.email,
    initials: r.user.initials,
    from: r.user.avatarFrom,
    to: r.user.avatarTo,
    role: r.role,
    joinedAt: r.joinedAt.toISOString(),
  }));
}

export async function listInvites(workspaceId: string): Promise<WorkspaceInvite[]> {
  const db = getDb();
  const rows = await db.query.workspaceInvites.findMany({
    where: eq(s.workspaceInvites.workspaceId, workspaceId),
    with: { createdBy: true },
    orderBy: [desc(s.workspaceInvites.createdAt)],
  });
  return rows.map((r: any) => ({
    id: r.id,
    token: r.token,
    role: r.role,
    expiresAt: r.expiresAt?.toISOString(),
    maxUses: r.maxUses,
    usedCount: r.usedCount,
    email: r.email ?? undefined,
    createdAt: r.createdAt.toISOString(),
    revokedAt: r.revokedAt?.toISOString(),
    createdByName: r.createdBy?.name,
  }));
}

export async function previewInvite(token: string) {
  const db = getDb();
  const inv = await db.query.workspaceInvites.findFirst({
    where: and(
      eq(s.workspaceInvites.token, token),
      isNull(s.workspaceInvites.revokedAt),
      or(isNull(s.workspaceInvites.expiresAt), gt(s.workspaceInvites.expiresAt, new Date()))!
    ),
    with: {
      workspace: { with: { owner: true } },
      createdBy: true,
    },
  });
  if (!inv) return null;
  if ((inv as any).workspace.archivedAt) return null;
  if (inv.maxUses > 0 && inv.usedCount >= inv.maxUses) return null;

  const [c] = await db
    .select({ n: count() })
    .from(s.workspaceMembers)
    .where(eq(s.workspaceMembers.workspaceId, inv.workspaceId));
  const memberCount = Number(c?.n ?? 0);

  return {
    workspace: toWorkspaceLite((inv as any).workspace, undefined, memberCount),
    role: inv.role as WorkspaceRole,
    invitedByName: (inv as any).createdBy?.name,
    expiresAt: inv.expiresAt?.toISOString(),
    email: inv.email ?? undefined,
  };
}

export async function listActivity(
  workspaceId: string,
  limit = 50
): Promise<WorkspaceActivityEntry[]> {
  const db = getDb();
  const rows = await db.query.workspaceActivity.findMany({
    where: eq(s.workspaceActivity.workspaceId, workspaceId),
    with: { actor: true, targetUser: true },
    orderBy: [desc(s.workspaceActivity.createdAt)],
    limit,
  });
  return rows.map((r: any) => ({
    id: r.id,
    kind: r.kind,
    actor: toUser(r.actor),
    targetUser: toUser(r.targetUser),
    payload: r.payload ?? undefined,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getPublicWorkspaceBySlug(slug: string): Promise<Workspace | null> {
  const db = getDb();
  const row = await db.query.workspaces.findFirst({
    where: and(eq(s.workspaces.slug, slug), eq(s.workspaces.isPublic, 1)),
    with: { owner: true },
  });
  if (!row || (row as any).archivedAt) return null;
  const [c] = await db
    .select({ n: count() })
    .from(s.workspaceMembers)
    .where(eq(s.workspaceMembers.workspaceId, row.id));
  return toWorkspaceLite(row, undefined, Number(c?.n ?? 0));
}

export async function listPublicWorkspaces(): Promise<Workspace[]> {
  const db = getDb();
  const rows = await db.query.workspaces.findMany({
    where: and(eq(s.workspaces.isPublic, 1), isNull(s.workspaces.archivedAt)),
    with: { owner: true },
    orderBy: [desc(s.workspaces.createdAt)],
    limit: 50,
  });
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const counts = await db
    .select({ workspaceId: s.workspaceMembers.workspaceId, n: count() })
    .from(s.workspaceMembers)
    .where(
      sql`${s.workspaceMembers.workspaceId} = ANY(${sql.raw(
        `ARRAY[${ids.map((id) => `'${id}'`).join(',')}]::uuid[]`
      )})`
    )
    .groupBy(s.workspaceMembers.workspaceId);
  const cMap = new Map(counts.map((c) => [c.workspaceId, Number(c.n)]));
  return rows.map((r: any) => toWorkspaceLite(r, undefined, cMap.get(r.id) ?? 0));
}
