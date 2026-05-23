'use server';

import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { setActiveWorkspaceCookie } from '@/lib/auth/workspace-cookie';
import { seedWorkspace, getTemplate } from '@/lib/db/workspace-templates';
import {
  canChangeRole,
  canDeleteWorkspace,
  canInvite,
  canKick,
  canTransferOwnership,
  isAtLeast,
} from '@/lib/auth/permissions';
import type { WorkspaceActivityKind, WorkspaceRole } from '@/lib/types';

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
      .slice(0, 32) || 'workspace'
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? 'W') + (parts[1]?.[0] ?? '')
  )
    .toUpperCase()
    .slice(0, 4);
}

async function logActivity(
  workspaceId: string,
  actorId: string | null,
  kind: WorkspaceActivityKind,
  payload: Record<string, unknown> = {},
  targetUserId?: string
) {
  const db = getDb();
  await db.insert(s.workspaceActivity).values({
    workspaceId,
    actorId,
    targetUserId: targetUserId ?? null,
    kind,
    payload,
  });
}

async function requireRole(
  workspaceId: string,
  userId: string,
  minimum: WorkspaceRole
): Promise<{ ok: true; role: WorkspaceRole } | { ok: false; error: string }> {
  const db = getDb();
  const m = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(s.workspaceMembers.workspaceId, workspaceId),
      eq(s.workspaceMembers.userId, userId)
    ),
    columns: { role: true },
  });
  if (!m) return { ok: false, error: 'Kein Mitglied in diesem Workspace.' };
  if (!isAtLeast(m.role as WorkspaceRole, minimum)) {
    return { ok: false, error: 'Keine Berechtigung.' };
  }
  return { ok: true, role: m.role as WorkspaceRole };
}

// ─── Switch ──────────────────────────────────────────────────
export async function switchWorkspace(slug: string): Promise<Result> {
  const user = await requireUser();
  const db = getDb();
  const ws = await db.query.workspaces.findFirst({ where: eq(s.workspaces.slug, slug) });
  if (!ws) return { ok: false, error: 'Workspace nicht gefunden.' };
  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(s.workspaceMembers.workspaceId, ws.id),
      eq(s.workspaceMembers.userId, user.id)
    ),
  });
  if (!member) return { ok: false, error: 'Keine Berechtigung für diesen Workspace.' };
  await setActiveWorkspaceCookie(slug);
  revalidatePath('/');
  return { ok: true };
}

// ─── Create (with template) ──────────────────────────────────
export async function createWorkspace(input: {
  name: string;
  template?: string;
  scope?: 'business' | 'private';
  iconEmoji?: string;
  fromColor?: string;
  toColor?: string;
  description?: string;
}): Promise<Result<{ slug: string }>> {
  const user = await requireUser();
  const db = getDb();

  const name = input.name.trim();
  if (!name) return { ok: false, error: 'Name erforderlich.' };

  const base = slugify(name);
  let slug = base;
  for (let i = 0; i < 8; i++) {
    const dup = await db.query.workspaces.findFirst({ where: eq(s.workspaces.slug, slug) });
    if (!dup) break;
    slug = `${base}-${Math.floor(Math.random() * 9999)}`;
  }

  const tpl = input.template ? getTemplate(input.template) : undefined;
  const scope: 'business' | 'private' =
    input.scope ?? tpl?.defaultScope ?? 'business';

  const [ws] = await db
    .insert(s.workspaces)
    .values({
      slug,
      name,
      short: initialsOf(name),
      fromColor: input.fromColor ?? tpl?.fromColor ?? '#5eb6ff',
      toColor: input.toColor ?? tpl?.toColor ?? '#0369a1',
      ownerId: user.id,
      description: input.description?.trim() || tpl?.description || null,
      iconEmoji: input.iconEmoji || tpl?.icon || null,
      template: input.template ?? null,
      scope,
    })
    .returning();

  await db.insert(s.workspaceMembers).values({
    workspaceId: ws.id,
    userId: user.id,
    role: 'owner',
  });

  await logActivity(ws.id, user.id, 'workspace_created', {
    name,
    template: input.template ?? null,
    scope,
  });

  if (input.template) {
    try {
      await seedWorkspace(ws.id, user.id, input.template);
    } catch {
      // best-effort
    }
  }

  await setActiveWorkspaceCookie(slug);
  revalidatePath('/');
  return { ok: true, slug };
}

export async function createWorkspaceFromForm(
  formData: FormData
): Promise<Result<{ slug: string }>> {
  const rawScope = String(formData.get('scope') ?? '');
  const scope: 'business' | 'private' | undefined =
    rawScope === 'private' || rawScope === 'business' ? rawScope : undefined;
  return createWorkspace({
    name: String(formData.get('name') ?? ''),
    template: String(formData.get('template') ?? '') || undefined,
    scope,
    iconEmoji: String(formData.get('iconEmoji') ?? '') || undefined,
    fromColor: String(formData.get('fromColor') ?? '') || undefined,
    toColor: String(formData.get('toColor') ?? '') || undefined,
    description: String(formData.get('description') ?? '') || undefined,
  });
}

// ─── Update workspace meta ───────────────────────────────────
export async function updateWorkspace(input: {
  workspaceId: string;
  patch: {
    name?: string;
    description?: string | null;
    iconEmoji?: string | null;
    fromColor?: string;
    toColor?: string;
    timezone?: string;
    isPublic?: boolean;
  };
}): Promise<Result> {
  const user = await requireUser();
  const check = await requireRole(input.workspaceId, user.id, 'admin');
  if (!check.ok) return check;

  const db = getDb();
  const ws = await db.query.workspaces.findFirst({
    where: eq(s.workspaces.id, input.workspaceId),
  });
  if (!ws) return { ok: false, error: 'Workspace nicht gefunden.' };

  const update: Record<string, any> = {};
  const changes: Record<string, unknown> = {};
  if (input.patch.name !== undefined) {
    const n = input.patch.name.trim();
    if (!n) return { ok: false, error: 'Name erforderlich.' };
    update.name = n;
    update.short = initialsOf(n);
    changes.name = n;
  }
  if (input.patch.description !== undefined) {
    update.description = input.patch.description || null;
    changes.description = input.patch.description;
  }
  if (input.patch.iconEmoji !== undefined) {
    update.iconEmoji = input.patch.iconEmoji || null;
    changes.iconEmoji = input.patch.iconEmoji;
  }
  if (input.patch.fromColor) {
    update.fromColor = input.patch.fromColor;
    changes.fromColor = input.patch.fromColor;
  }
  if (input.patch.toColor) {
    update.toColor = input.patch.toColor;
    changes.toColor = input.patch.toColor;
  }
  if (input.patch.timezone) {
    update.timezone = input.patch.timezone;
    changes.timezone = input.patch.timezone;
  }
  if (input.patch.isPublic !== undefined) {
    update.isPublic = input.patch.isPublic ? 1 : 0;
    changes.isPublic = input.patch.isPublic;
  }

  if (Object.keys(update).length === 0) return { ok: true };
  await db.update(s.workspaces).set(update).where(eq(s.workspaces.id, input.workspaceId));
  await logActivity(input.workspaceId, user.id, 'settings_changed', changes);
  revalidatePath('/workspace/settings');
  revalidatePath('/');
  return { ok: true };
}

// ─── Invites ─────────────────────────────────────────────────
export async function createInvite(input: {
  workspaceId: string;
  role?: WorkspaceRole;
  expiresInDays?: number | null;
  maxUses?: number;
  email?: string;
}): Promise<Result<{ token: string }>> {
  const user = await requireUser();
  const check = await requireRole(input.workspaceId, user.id, 'admin');
  if (!check.ok) return check;
  if (!canInvite(check.role)) return { ok: false, error: 'Keine Berechtigung.' };

  const db = getDb();
  const role = input.role ?? 'member';
  if (role === 'owner')
    return { ok: false, error: 'Owner-Rolle kann nicht per Invite vergeben werden.' };

  const token = randomBytes(24).toString('hex');
  const expiresAt =
    input.expiresInDays && input.expiresInDays > 0
      ? new Date(Date.now() + input.expiresInDays * 86_400_000)
      : null;

  await db.insert(s.workspaceInvites).values({
    workspaceId: input.workspaceId,
    token,
    role,
    expiresAt,
    maxUses: input.maxUses ?? 0,
    email: input.email?.trim().toLowerCase() || null,
    createdById: user.id,
  });

  await logActivity(input.workspaceId, user.id, 'invite_created', {
    role,
    expiresAt: expiresAt?.toISOString(),
    email: input.email ?? null,
    maxUses: input.maxUses ?? 0,
  });
  revalidatePath('/workspace/settings');
  return { ok: true, token };
}

export async function revokeInvite(inviteId: string): Promise<Result> {
  const user = await requireUser();
  const db = getDb();
  const inv = await db.query.workspaceInvites.findFirst({
    where: eq(s.workspaceInvites.id, inviteId),
  });
  if (!inv) return { ok: false, error: 'Invite nicht gefunden.' };
  const check = await requireRole(inv.workspaceId, user.id, 'admin');
  if (!check.ok) return check;
  await db
    .update(s.workspaceInvites)
    .set({ revokedAt: new Date() })
    .where(eq(s.workspaceInvites.id, inviteId));
  await logActivity(inv.workspaceId, user.id, 'invite_revoked', {
    token: inv.token.slice(0, 8),
  });
  revalidatePath('/workspace/settings');
  return { ok: true };
}

export async function joinViaInvite(token: string): Promise<Result<{ slug: string }>> {
  const user = await requireUser();
  const db = getDb();
  const inv = await db.query.workspaceInvites.findFirst({
    where: eq(s.workspaceInvites.token, token),
    with: { workspace: true },
  });
  if (!inv || inv.revokedAt) return { ok: false, error: 'Invite ungültig oder widerrufen.' };
  if (inv.expiresAt && inv.expiresAt < new Date())
    return { ok: false, error: 'Invite abgelaufen.' };
  if (inv.maxUses > 0 && inv.usedCount >= inv.maxUses)
    return { ok: false, error: 'Invite-Limit erreicht.' };
  if ((inv as any).workspace.archivedAt)
    return { ok: false, error: 'Workspace ist archiviert.' };
  if (inv.email && inv.email.toLowerCase() !== user.email.toLowerCase()) {
    return { ok: false, error: 'Invite ist für eine andere Email-Adresse.' };
  }

  const existing = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(s.workspaceMembers.workspaceId, inv.workspaceId),
      eq(s.workspaceMembers.userId, user.id)
    ),
  });
  if (existing) {
    await setActiveWorkspaceCookie((inv as any).workspace.slug);
    return { ok: true, slug: (inv as any).workspace.slug };
  }

  await db.insert(s.workspaceMembers).values({
    workspaceId: inv.workspaceId,
    userId: user.id,
    role: inv.role,
  });
  await db
    .update(s.workspaceInvites)
    .set({ usedCount: inv.usedCount + 1 })
    .where(eq(s.workspaceInvites.id, inv.id));
  await logActivity(inv.workspaceId, user.id, 'invite_redeemed', {
    token: inv.token.slice(0, 8),
    role: inv.role,
  });
  await logActivity(inv.workspaceId, user.id, 'member_joined', { role: inv.role });

  await setActiveWorkspaceCookie((inv as any).workspace.slug);
  revalidatePath('/');
  return { ok: true, slug: (inv as any).workspace.slug };
}

// ─── Member management ───────────────────────────────────────
export async function updateMemberRole(input: {
  workspaceId: string;
  targetUserId: string;
  newRole: WorkspaceRole;
}): Promise<Result> {
  const user = await requireUser();
  const check = await requireRole(input.workspaceId, user.id, 'admin');
  if (!check.ok) return check;
  if (input.targetUserId === user.id) return { ok: false, error: 'Eigene Rolle nicht änderbar.' };

  const db = getDb();
  const target = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(s.workspaceMembers.workspaceId, input.workspaceId),
      eq(s.workspaceMembers.userId, input.targetUserId)
    ),
  });
  if (!target) return { ok: false, error: 'Mitglied nicht gefunden.' };

  if (!canChangeRole(check.role, target.role as WorkspaceRole, input.newRole)) {
    return { ok: false, error: 'Diese Rollen-Änderung ist nicht erlaubt.' };
  }

  await db
    .update(s.workspaceMembers)
    .set({ role: input.newRole })
    .where(
      and(
        eq(s.workspaceMembers.workspaceId, input.workspaceId),
        eq(s.workspaceMembers.userId, input.targetUserId)
      )
    );

  await logActivity(
    input.workspaceId,
    user.id,
    'role_changed',
    { from: target.role, to: input.newRole },
    input.targetUserId
  );
  revalidatePath('/workspace/settings');
  return { ok: true };
}

export async function removeMember(input: {
  workspaceId: string;
  targetUserId: string;
}): Promise<Result> {
  const user = await requireUser();
  const check = await requireRole(input.workspaceId, user.id, 'admin');
  if (!check.ok) return check;
  if (input.targetUserId === user.id)
    return {
      ok: false,
      error: 'Du kannst dich nicht selbst kicken — nutze „Workspace verlassen".',
    };

  const db = getDb();
  const target = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(s.workspaceMembers.workspaceId, input.workspaceId),
      eq(s.workspaceMembers.userId, input.targetUserId)
    ),
  });
  if (!target) return { ok: false, error: 'Mitglied nicht gefunden.' };
  if (!canKick(check.role, target.role as WorkspaceRole)) {
    return { ok: false, error: 'Du kannst diese Person nicht kicken.' };
  }

  await db
    .delete(s.workspaceMembers)
    .where(
      and(
        eq(s.workspaceMembers.workspaceId, input.workspaceId),
        eq(s.workspaceMembers.userId, input.targetUserId)
      )
    );

  await logActivity(input.workspaceId, user.id, 'member_kicked', {}, input.targetUserId);
  revalidatePath('/workspace/settings');
  return { ok: true };
}

export async function leaveWorkspace(workspaceId: string): Promise<Result> {
  const user = await requireUser();
  const db = getDb();
  const ws = await db.query.workspaces.findFirst({
    where: eq(s.workspaces.id, workspaceId),
  });
  if (!ws) return { ok: false, error: 'Workspace nicht gefunden.' };
  if (ws.ownerId === user.id) {
    return {
      ok: false,
      error:
        'Als Owner kannst du den Workspace nicht verlassen. Transferiere Ownership oder lösche den Workspace.',
    };
  }
  await db
    .delete(s.workspaceMembers)
    .where(
      and(
        eq(s.workspaceMembers.workspaceId, workspaceId),
        eq(s.workspaceMembers.userId, user.id)
      )
    );
  await logActivity(workspaceId, user.id, 'member_left');
  revalidatePath('/');
  return { ok: true };
}

export async function transferOwnership(input: {
  workspaceId: string;
  newOwnerId: string;
}): Promise<Result> {
  const user = await requireUser();
  const check = await requireRole(input.workspaceId, user.id, 'owner');
  if (!check.ok) return check;
  if (!canTransferOwnership(check.role)) return { ok: false, error: 'Keine Berechtigung.' };
  if (input.newOwnerId === user.id) return { ok: false, error: 'Du bist bereits Owner.' };

  const db = getDb();
  const target = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(s.workspaceMembers.workspaceId, input.workspaceId),
      eq(s.workspaceMembers.userId, input.newOwnerId)
    ),
  });
  if (!target) return { ok: false, error: 'Neuer Owner muss bereits Mitglied sein.' };

  await db
    .update(s.workspaceMembers)
    .set({ role: 'admin' })
    .where(
      and(
        eq(s.workspaceMembers.workspaceId, input.workspaceId),
        eq(s.workspaceMembers.userId, user.id)
      )
    );
  await db
    .update(s.workspaceMembers)
    .set({ role: 'owner' })
    .where(
      and(
        eq(s.workspaceMembers.workspaceId, input.workspaceId),
        eq(s.workspaceMembers.userId, input.newOwnerId)
      )
    );
  await db
    .update(s.workspaces)
    .set({ ownerId: input.newOwnerId })
    .where(eq(s.workspaces.id, input.workspaceId));

  await logActivity(
    input.workspaceId,
    user.id,
    'ownership_transferred',
    {},
    input.newOwnerId
  );
  revalidatePath('/workspace/settings');
  return { ok: true };
}

// ─── Archive / unarchive / delete ────────────────────────────
export async function archiveWorkspace(workspaceId: string): Promise<Result> {
  const user = await requireUser();
  const check = await requireRole(workspaceId, user.id, 'owner');
  if (!check.ok) return check;
  const db = getDb();
  await db
    .update(s.workspaces)
    .set({ archivedAt: new Date() })
    .where(eq(s.workspaces.id, workspaceId));
  await logActivity(workspaceId, user.id, 'workspace_archived');
  revalidatePath('/');
  return { ok: true };
}

export async function unarchiveWorkspace(workspaceId: string): Promise<Result> {
  const user = await requireUser();
  const check = await requireRole(workspaceId, user.id, 'owner');
  if (!check.ok) return check;
  const db = getDb();
  await db
    .update(s.workspaces)
    .set({ archivedAt: null })
    .where(eq(s.workspaces.id, workspaceId));
  await logActivity(workspaceId, user.id, 'workspace_unarchived');
  revalidatePath('/');
  return { ok: true };
}

export async function deleteWorkspace(workspaceId: string): Promise<Result> {
  const user = await requireUser();
  const check = await requireRole(workspaceId, user.id, 'owner');
  if (!check.ok) return check;
  if (!canDeleteWorkspace(check.role)) return { ok: false, error: 'Keine Berechtigung.' };
  const db = getDb();
  await db.delete(s.workspaces).where(eq(s.workspaces.id, workspaceId));
  revalidatePath('/');
  return { ok: true };
}
