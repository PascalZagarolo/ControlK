'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { generateShareToken } from '@/lib/db/queries/share-links';

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

export async function createShareLinkForGroup(input: {
  groupId: string;
  expiresInDays?: number | null;
}): Promise<Result<{ token: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();

  // Confirm group belongs to workspace
  const group = await db.query.todoGroups.findFirst({
    where: and(eq(s.todoGroups.id, input.groupId), eq(s.todoGroups.workspaceId, ws.id)),
  });
  if (!group) return { ok: false, error: 'Gruppe nicht gefunden.' };

  const token = generateShareToken();
  const expiresAt =
    input.expiresInDays && input.expiresInDays > 0
      ? new Date(Date.now() + input.expiresInDays * 86_400_000)
      : null;

  await db.insert(s.shareLinks).values({
    workspaceId: ws.id,
    groupId: input.groupId,
    token,
    expiresAt,
    createdById: user.id,
  });

  revalidatePath(`/todos/${group.slug}`);
  return { ok: true, token };
}

export async function revokeShareLink(linkId: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await db.query.shareLinks.findFirst({
    where: and(eq(s.shareLinks.id, linkId), eq(s.shareLinks.workspaceId, ws.id)),
  });
  if (!row) return { ok: false, error: 'Link nicht gefunden.' };
  await db.delete(s.shareLinks).where(eq(s.shareLinks.id, linkId));
  revalidatePath('/todos');
  return { ok: true };
}
