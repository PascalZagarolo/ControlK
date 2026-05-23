import 'server-only';
import { Policy, deny, ALLOW, roleAtLeast } from './policies';

/**
 * Policy for the todos table.
 *
 * Defaults:
 *   - read: any workspace member can read team/account todos
 *   - read-private: only creator + assignee
 *   - update: creator, assignee, watcher, or admin
 *   - delete: creator or admin
 *   - reassign: admin only
 *   - share: creator or admin
 */
export type TodoForPolicy = {
  workspaceId: string;
  createdById: string | null;
  assigneeId: string | null;
  visibility: 'team' | 'account' | 'private';
  watcherIds?: string[];
};

export type TodoAction =
  | 'read'
  | 'update'
  | 'delete'
  | 'reassign'
  | 'share';

export const todoPolicy: Policy<TodoForPolicy, TodoAction> = (subject, todo, action) => {
  if (todo.workspaceId !== subject.workspaceId) {
    return deny('cross-workspace');
  }

  const isCreator = todo.createdById === subject.userId;
  const isAssignee = todo.assigneeId === subject.userId;
  const isWatcher = (todo.watcherIds ?? []).includes(subject.userId);
  const isAdmin = roleAtLeast(subject, 'admin');

  // Guests: only read, and only non-private todos
  if (subject.role === 'guest') {
    if (action !== 'read') return deny('guest-read-only');
    if (todo.visibility === 'private') return deny('private-not-visible-to-guests');
    return ALLOW;
  }

  switch (action) {
    case 'read':
      if (todo.visibility === 'private' && !(isCreator || isAssignee || isAdmin)) {
        return deny('private-not-yours');
      }
      return ALLOW;
    case 'update':
      if (isCreator || isAssignee || isWatcher || isAdmin) return ALLOW;
      return deny('not-collaborator');
    case 'delete':
      if (isCreator || isAdmin) return ALLOW;
      return deny('only-creator-or-admin');
    case 'reassign':
      if (isAdmin) return ALLOW;
      return deny('admin-only');
    case 'share':
      if (isCreator || isAdmin) return ALLOW;
      return deny('only-creator-or-admin');
    default:
      return deny('unknown-action');
  }
};
