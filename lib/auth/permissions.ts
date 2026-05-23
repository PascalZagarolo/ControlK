import type { WorkspaceRole } from '@/lib/types';

const RANK: Record<WorkspaceRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  guest: 1,
};

export function canEditWorkspace(role: WorkspaceRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function canDeleteWorkspace(role: WorkspaceRole): boolean {
  return role === 'owner';
}

export function canInvite(role: WorkspaceRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function canKick(role: WorkspaceRole, targetRole: WorkspaceRole): boolean {
  if (targetRole === 'owner') return false;
  return RANK[role] > RANK[targetRole];
}

export function canChangeRole(
  role: WorkspaceRole,
  fromRole: WorkspaceRole,
  toRole: WorkspaceRole
): boolean {
  if (fromRole === 'owner' || toRole === 'owner') return false; // ownership transfer is its own action
  return RANK[role] > RANK[fromRole] && RANK[role] > RANK[toRole];
}

export function canTransferOwnership(role: WorkspaceRole): boolean {
  return role === 'owner';
}

export function isAtLeast(role: WorkspaceRole, minimum: WorkspaceRole): boolean {
  return RANK[role] >= RANK[minimum];
}
