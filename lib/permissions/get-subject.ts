import 'server-only';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import type { Subject, SubjectRole } from './policies';

/**
 * Loads the current user's role in a workspace and packages it as a Subject
 * ready for policy evaluation. Returns null if the user is not a member.
 */
export async function getSubject(
  userId: string,
  workspaceId: string
): Promise<Subject | null> {
  const db = getDb();
  const m = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(s.workspaceMembers.workspaceId, workspaceId),
      eq(s.workspaceMembers.userId, userId)
    ),
    columns: { role: true },
  });
  if (!m) return null;
  return {
    userId,
    workspaceId,
    role: m.role as SubjectRole,
  };
}
