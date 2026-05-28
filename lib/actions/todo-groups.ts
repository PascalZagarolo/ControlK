'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, isNull, max } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import type { TodoPriority, TodoVisibility } from '@/lib/types';

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 48) || 'gruppe'
  );
}

export async function createTodoGroup(formData: FormData): Promise<Result<{ slug: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();

  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const emoji = String(formData.get('emoji') ?? '').trim() || null;
  const color = String(formData.get('color') ?? '').trim() || null;
  let projectId = String(formData.get('projectId') ?? '').trim() || null;
  const parentGroupId = String(formData.get('parentGroupId') ?? '').trim() || null;
  const defaultAssigneeId = String(formData.get('defaultAssigneeId') ?? '') || null;
  const defaultPriority =
    (String(formData.get('defaultPriority') ?? '') as TodoPriority) || null;
  const defaultVisibility =
    (String(formData.get('defaultVisibility') ?? '') as TodoVisibility) || null;
  if (!name) return { ok: false, error: 'Name erforderlich.' };
  if (name.length > 60) return { ok: false, error: 'Name zu lang.' };

  // Validate the parent (if any): it must live in this workspace and be a
  // top-level group itself — we allow exactly one level of nesting.
  let parent: typeof s.todoGroups.$inferSelect | undefined;
  if (parentGroupId) {
    parent = await db.query.todoGroups.findFirst({
      where: and(eq(s.todoGroups.id, parentGroupId), eq(s.todoGroups.workspaceId, ws.id)),
    });
    if (!parent) return { ok: false, error: 'Übergeordnete Gruppe nicht gefunden.' };
    if (parent.parentGroupId)
      return { ok: false, error: 'Maximal eine Verschachtelungsebene erlaubt.' };
    // A subgroup inherits its parent's project unless one was given explicitly.
    if (!projectId) projectId = parent.projectId ?? null;
  }

  let slug = slugify(name);
  for (let i = 0; i < 8; i++) {
    const dup = await db.query.todoGroups.findFirst({
      where: and(eq(s.todoGroups.workspaceId, ws.id), eq(s.todoGroups.slug, slug)),
    });
    if (!dup) break;
    slug = `${slugify(name)}-${Math.floor(Math.random() * 999)}`;
  }

  // Position is scoped to the sibling level (within the same parent), so a
  // new subgroup is ordered relative to its siblings, not the whole workspace.
  const [posRow] = await db
    .select({ m: max(s.todoGroups.position) })
    .from(s.todoGroups)
    .where(
      and(
        eq(s.todoGroups.workspaceId, ws.id),
        parentGroupId
          ? eq(s.todoGroups.parentGroupId, parentGroupId)
          : isNull(s.todoGroups.parentGroupId)
      )
    );
  const nextPos = (posRow?.m ?? -1) + 1;

  await db.insert(s.todoGroups).values({
    workspaceId: ws.id,
    slug,
    name,
    description,
    emoji,
    color,
    projectId: projectId as any,
    parentGroupId: parentGroupId as any,
    position: nextPos,
    createdById: user.id,
    defaultAssigneeId,
    defaultPriority,
    defaultVisibility,
  });

  revalidatePath('/todos');
  revalidatePath('/');
  return { ok: true, slug };
}

export async function updateTodoGroup(
  slug: string,
  fields: {
    name?: string;
    description?: string | null;
    emoji?: string | null;
    color?: string | null;
    defaultAssigneeId?: string | null;
    defaultPriority?: TodoPriority | null;
    defaultVisibility?: TodoVisibility | null;
  }
): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof fields.name === 'string') {
    const trimmed = fields.name.trim();
    if (!trimmed) return { ok: false, error: 'Name erforderlich.' };
    patch.name = trimmed;
  }
  if (fields.description !== undefined) patch.description = fields.description || null;
  if (fields.emoji !== undefined) patch.emoji = fields.emoji || null;
  if (fields.color !== undefined) patch.color = fields.color || null;
  if (fields.defaultAssigneeId !== undefined)
    patch.defaultAssigneeId = fields.defaultAssigneeId || null;
  if (fields.defaultPriority !== undefined)
    patch.defaultPriority = fields.defaultPriority || null;
  if (fields.defaultVisibility !== undefined)
    patch.defaultVisibility = fields.defaultVisibility || null;

  await db
    .update(s.todoGroups)
    .set(patch)
    .where(and(eq(s.todoGroups.workspaceId, ws.id), eq(s.todoGroups.slug, slug)));

  revalidatePath('/todos');
  revalidatePath(`/todos/${slug}`);
  revalidatePath('/');
  return { ok: true };
}

export async function toggleTodoGroupPin(slug: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await db.query.todoGroups.findFirst({
    where: and(eq(s.todoGroups.workspaceId, ws.id), eq(s.todoGroups.slug, slug)),
  });
  if (!row) return { ok: false, error: 'Gruppe nicht gefunden.' };
  await db
    .update(s.todoGroups)
    .set({ pinned: row.pinned === 1 ? 0 : 1, updatedAt: new Date() })
    .where(eq(s.todoGroups.id, row.id));
  revalidatePath('/todos');
  revalidatePath('/');
  return { ok: true };
}

export async function archiveTodoGroup(slug: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  await db
    .update(s.todoGroups)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(s.todoGroups.workspaceId, ws.id), eq(s.todoGroups.slug, slug)));
  revalidatePath('/todos');
  revalidatePath('/');
  return { ok: true };
}

export async function unarchiveTodoGroup(slug: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  await db
    .update(s.todoGroups)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(and(eq(s.todoGroups.workspaceId, ws.id), eq(s.todoGroups.slug, slug)));
  revalidatePath('/todos');
  revalidatePath('/');
  return { ok: true };
}

export async function deleteTodoGroup(slug: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await db.query.todoGroups.findFirst({
    where: and(eq(s.todoGroups.workspaceId, ws.id), eq(s.todoGroups.slug, slug)),
  });
  if (!row) return { ok: false, error: 'Gruppe nicht gefunden.' };
  await db.delete(s.todoGroups).where(eq(s.todoGroups.id, row.id));
  revalidatePath('/todos');
  revalidatePath('/');
  return { ok: true };
}

export async function moveTodoToGroup(
  todoId: string,
  groupId: string | null
): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const todo = await db.query.todos.findFirst({
    where: and(eq(s.todos.id, todoId), eq(s.todos.workspaceId, ws.id)),
  });
  if (!todo) return { ok: false, error: 'Todo nicht gefunden.' };
  if (groupId) {
    const group = await db.query.todoGroups.findFirst({
      where: and(eq(s.todoGroups.id, groupId), eq(s.todoGroups.workspaceId, ws.id)),
    });
    if (!group) return { ok: false, error: 'Gruppe nicht gefunden.' };
  }
  await db.update(s.todos).set({ groupId, updatedAt: new Date() }).where(eq(s.todos.id, todoId));
  revalidatePath('/todos');
  return { ok: true };
}

/**
 * Move a group under a parent (nest it) or out to the top level (parentSlug
 * = null). Enforces the one-level-depth invariant from both sides: the group
 * being moved must have no children of its own, and the target parent must
 * itself be top-level.
 */
export async function setTodoGroupParent(
  slug: string,
  parentSlug: string | null
): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();

  const group = await db.query.todoGroups.findFirst({
    where: and(eq(s.todoGroups.workspaceId, ws.id), eq(s.todoGroups.slug, slug)),
  });
  if (!group) return { ok: false, error: 'Gruppe nicht gefunden.' };

  // A group with subgroups can't itself become a subgroup (would be 2 levels).
  const child = await db.query.todoGroups.findFirst({
    where: and(eq(s.todoGroups.workspaceId, ws.id), eq(s.todoGroups.parentGroupId, group.id)),
    columns: { id: true },
  });
  if (child)
    return { ok: false, error: 'Gruppen mit Untergruppen können nicht verschachtelt werden.' };

  let parentGroupId: string | null = null;
  if (parentSlug) {
    const parent = await db.query.todoGroups.findFirst({
      where: and(eq(s.todoGroups.workspaceId, ws.id), eq(s.todoGroups.slug, parentSlug)),
    });
    if (!parent) return { ok: false, error: 'Übergeordnete Gruppe nicht gefunden.' };
    if (parent.id === group.id)
      return { ok: false, error: 'Eine Gruppe kann nicht sich selbst übergeordnet sein.' };
    if (parent.parentGroupId)
      return { ok: false, error: 'Maximal eine Verschachtelungsebene erlaubt.' };
    parentGroupId = parent.id;
  }

  // Re-position at the end of the destination sibling level.
  const [posRow] = await db
    .select({ m: max(s.todoGroups.position) })
    .from(s.todoGroups)
    .where(
      and(
        eq(s.todoGroups.workspaceId, ws.id),
        parentGroupId
          ? eq(s.todoGroups.parentGroupId, parentGroupId)
          : isNull(s.todoGroups.parentGroupId)
      )
    );
  const nextPos = (posRow?.m ?? -1) + 1;

  await db
    .update(s.todoGroups)
    .set({ parentGroupId, position: nextPos, updatedAt: new Date() })
    .where(eq(s.todoGroups.id, group.id));

  revalidatePath('/todos');
  revalidatePath(`/todos/${slug}`);
  if (parentSlug) revalidatePath(`/todos/${parentSlug}`);
  revalidatePath('/');
  return { ok: true };
}

export async function reorderTodoGroups(
  slugsInOrder: string[],
  parentSlug: string | null = null
): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  // Positions are scoped to one sibling level. Callers pass the slugs of the
  // groups sharing a parent (or all top-level groups when parentSlug is null),
  // so reordering one level never disturbs another.
  for (let i = 0; i < slugsInOrder.length; i++) {
    await db
      .update(s.todoGroups)
      .set({ position: i })
      .where(and(eq(s.todoGroups.workspaceId, ws.id), eq(s.todoGroups.slug, slugsInOrder[i])));
  }
  revalidatePath('/todos');
  if (parentSlug) revalidatePath(`/todos/${parentSlug}`);
  return { ok: true };
}
