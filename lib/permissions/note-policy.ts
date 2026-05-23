import 'server-only';
import { Policy, deny, ALLOW, roleAtLeast } from './policies';

export type NoteForPolicy = {
  workspaceId: string;
  createdById: string | null;
  scope: 'private' | 'workspace' | 'public';
};

export type NoteAction = 'read' | 'update' | 'delete' | 'share';

export const notePolicy: Policy<NoteForPolicy, NoteAction> = (subject, note, action) => {
  if (note.workspaceId !== subject.workspaceId) return deny('cross-workspace');

  const isCreator = note.createdById === subject.userId;
  const isAdmin = roleAtLeast(subject, 'admin');

  if (subject.role === 'guest') {
    if (action !== 'read') return deny('guest-read-only');
    if (note.scope === 'private' && !isCreator) return deny('private-not-yours');
    return ALLOW;
  }

  switch (action) {
    case 'read':
      if (note.scope === 'private' && !(isCreator || isAdmin)) return deny('private-not-yours');
      return ALLOW;
    case 'update':
      if (note.scope === 'private' && !(isCreator || isAdmin)) return deny('private-not-yours');
      return ALLOW;
    case 'delete':
      if (isCreator || isAdmin) return ALLOW;
      return deny('only-creator-or-admin');
    case 'share':
      if (isCreator || isAdmin) return ALLOW;
      return deny('only-creator-or-admin');
    default:
      return deny('unknown-action');
  }
};
