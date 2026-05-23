import 'server-only';
import { cache } from 'react';
import { and, asc, eq } from 'drizzle-orm';
import { getDb } from './client';
import * as s from './schema';
import { currentUser, type SessionUser } from '@/lib/auth/current-user';
import { getActiveWorkspaceCookie } from '@/lib/auth/workspace-cookie';

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 32) || 'workspace'
  );
}

async function bootstrapDefaultWorkspace(user: SessionUser) {
  const db = getDb();
  const base = slugify(user.name);
  let slug = base;
  for (let i = 0; i < 8; i++) {
    const dup = await db.query.workspaces.findFirst({ where: eq(s.workspaces.slug, slug) });
    if (!dup) break;
    slug = `${base}-${Math.floor(Math.random() * 9999)}`;
  }
  const [ws] = await db
    .insert(s.workspaces)
    .values({
      slug,
      name: `${user.name.split(' ')[0]}'s Workspace`,
      short: user.initials.slice(0, 2),
      fromColor: user.avatarFrom,
      toColor: user.avatarTo,
      ownerId: user.id,
    })
    .returning();
  await db.insert(s.workspaceMembers).values({
    workspaceId: ws.id,
    userId: user.id,
    role: 'owner',
  });
  return ws;
}

/**
 * Resolves the active workspace for the current session user.
 * 1. Cookie-pinned slug (if user is still a member)
 * 2. First membership by joinedAt
 * 3. Auto-bootstraps a personal workspace if none exist
 */
export const getCurrentWorkspace = cache(async () => {
  const user = await currentUser();
  if (!user) return null;

  const db = getDb();
  const cookieSlug = await getActiveWorkspaceCookie();
  if (cookieSlug) {
    const pinned = await db.query.workspaces.findFirst({
      where: eq(s.workspaces.slug, cookieSlug),
    });
    if (pinned) {
      const member = await db.query.workspaceMembers.findFirst({
        where: and(
          eq(s.workspaceMembers.workspaceId, pinned.id),
          eq(s.workspaceMembers.userId, user.id)
        ),
      });
      if (member) return pinned;
    }
  }

  const membership = await db.query.workspaceMembers.findFirst({
    where: eq(s.workspaceMembers.userId, user.id),
    orderBy: [asc(s.workspaceMembers.joinedAt)],
    with: { workspace: true },
  });
  if (membership?.workspace) return membership.workspace;

  return await bootstrapDefaultWorkspace(user);
});

export async function listUserWorkspaces() {
  const user = await currentUser();
  if (!user) return [];
  const db = getDb();
  const rows = await db.query.workspaceMembers.findMany({
    where: eq(s.workspaceMembers.userId, user.id),
    orderBy: [asc(s.workspaceMembers.joinedAt)],
    with: { workspace: true },
  });
  return rows.map((r) => r.workspace);
}

export async function requireCurrentWorkspace() {
  const ws = await getCurrentWorkspace();
  if (!ws) throw new Error('Not authenticated');
  return ws;
}
