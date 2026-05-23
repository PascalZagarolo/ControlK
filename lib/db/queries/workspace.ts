import 'server-only';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';

export async function getWorkspaceBySlug(slug: string) {
  const db = getDb();
  return db.query.workspaces.findFirst({ where: eq(s.workspaces.slug, slug) });
}

export async function listWorkspacesForUser(userId: string) {
  const db = getDb();
  return db.query.workspaces.findMany({
    where: (w, { exists, and, eq: e }) =>
      exists(
        db
          .select({ x: s.workspaceMembers.userId })
          .from(s.workspaceMembers)
          .where(and(e(s.workspaceMembers.workspaceId, w.id), e(s.workspaceMembers.userId, userId)))
      ),
  });
}

export async function isWorkspaceMember(workspaceId: string, userId: string) {
  const db = getDb();
  const row = await db.query.workspaceMembers.findFirst({
    where: and(eq(s.workspaceMembers.workspaceId, workspaceId), eq(s.workspaceMembers.userId, userId)),
  });
  return !!row;
}
