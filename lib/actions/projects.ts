'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 48) || 'projekt'
  );
}

export async function createProject(input: {
  name: string;
  description?: string;
  color?: string;
}): Promise<Result<{ id: string; slug: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();

  const name = input.name.trim();
  if (!name) return { ok: false, error: 'Name erforderlich.' };

  const base = slugify(name);
  let slug = base;
  for (let i = 0; i < 8; i++) {
    const dup = await db.query.projects.findFirst({
      where: and(eq(s.projects.workspaceId, ws.id), eq(s.projects.slug, slug)),
    });
    if (!dup) break;
    slug = `${base}-${Math.floor(Math.random() * 9999)}`;
  }

  const [row] = await db
    .insert(s.projects)
    .values({
      workspaceId: ws.id,
      slug,
      name,
      description: input.description?.trim() || null,
      color: input.color || null,
      createdById: user.id,
    })
    .returning();

  revalidatePath('/todos');
  return { ok: true, id: row.id, slug: row.slug };
}

export async function archiveProject(id: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  await db
    .update(s.projects)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(s.projects.workspaceId, ws.id), eq(s.projects.id, id)));
  revalidatePath('/todos');
  return { ok: true };
}

/**
 * Move a todo-group into (or out of) a project. Also propagates the
 * project_id denormalization down to all todos in the group so the
 * project-filter query can be a single indexed where-clause.
 */
export async function assignGroupToProject(input: {
  groupId: string;
  projectId: string | null;
}): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();

  await db
    .update(s.todoGroups)
    .set({ projectId: input.projectId as any, updatedAt: new Date() })
    .where(and(eq(s.todoGroups.workspaceId, ws.id), eq(s.todoGroups.id, input.groupId)));

  // Denormalize to all todos in this group
  await db.execute(sql`
    UPDATE "todos"
    SET "project_id" = ${input.projectId}
    WHERE "workspace_id" = ${ws.id} AND "group_id" = ${input.groupId};
  `);

  revalidatePath('/todos');
  return { ok: true };
}
