'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { setActiveWorkspaceCookie } from '@/lib/auth/workspace-cookie';

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

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

export async function switchWorkspace(slug: string): Promise<Result> {
  const user = await requireUser();
  const db = getDb();
  const ws = await db.query.workspaces.findFirst({ where: eq(s.workspaces.slug, slug) });
  if (!ws) return { ok: false, error: 'Workspace nicht gefunden.' };
  const member = await db.query.workspaceMembers.findFirst({
    where: and(eq(s.workspaceMembers.workspaceId, ws.id), eq(s.workspaceMembers.userId, user.id)),
  });
  if (!member) return { ok: false, error: 'Keine Berechtigung für diesen Workspace.' };
  await setActiveWorkspaceCookie(slug);
  revalidatePath('/');
  return { ok: true };
}

export async function createWorkspace(formData: FormData): Promise<Result<{ slug: string }>> {
  const user = await requireUser();
  const db = getDb();

  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { ok: false, error: 'Name erforderlich.' };

  const base = slugify(name);
  let slug = base;
  for (let i = 0; i < 8; i++) {
    const dup = await db.query.workspaces.findFirst({ where: eq(s.workspaces.slug, slug) });
    if (!dup) break;
    slug = `${base}-${Math.floor(Math.random() * 9999)}`;
  }

  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'WS';

  const [ws] = await db
    .insert(s.workspaces)
    .values({
      slug,
      name,
      short: initials,
      fromColor: '#5eb6ff',
      toColor: '#0369a1',
      ownerId: user.id,
    })
    .returning();
  await db.insert(s.workspaceMembers).values({
    workspaceId: ws.id,
    userId: user.id,
    role: 'owner',
  });
  await setActiveWorkspaceCookie(slug);
  revalidatePath('/');
  return { ok: true, slug };
}
