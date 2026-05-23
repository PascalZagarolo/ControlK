import 'server-only';
import { eq, asc } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';
import type { TodoUser } from '@/lib/types';

export async function listWorkspaceMembers(workspaceId: string): Promise<TodoUser[]> {
  const db = getDb();
  const rows = await db.query.workspaceMembers.findMany({
    where: eq(s.workspaceMembers.workspaceId, workspaceId),
    orderBy: [asc(s.workspaceMembers.joinedAt)],
    with: { user: true },
  });
  return rows.map((r) => ({
    id: r.user.id,
    name: r.user.name,
    initials: r.user.initials,
    from: r.user.avatarFrom,
    to: r.user.avatarTo,
  }));
}
