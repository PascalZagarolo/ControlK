import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import {
  getMyRole,
  listActivity,
  listInvites,
  listMembers,
} from '@/lib/db/queries/workspace';
import { WorkspaceSettingsClient } from '@/components/workspace/workspace-settings-client';

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/workspace/settings');
  const ws = await requireCurrentWorkspace();

  const [role, members, invites, activity] = await Promise.all([
    getMyRole(ws.id, user.id),
    listMembers(ws.id),
    listInvites(ws.id),
    listActivity(ws.id, 50),
  ]);

  if (!role) redirect('/');

  return (
    <WorkspaceSettingsClient
      workspace={{
        id: ws.id,
        slug: ws.slug,
        name: ws.name,
        short: ws.short,
        from: ws.fromColor,
        to: ws.toColor,
        description: ws.description ?? undefined,
        iconEmoji: ws.iconEmoji ?? undefined,
        timezone: ws.timezone ?? undefined,
        isPublic: ws.isPublic === 1,
      }}
      myRole={role}
      myUserId={user.id}
      members={members}
      invites={invites}
      activity={activity}
    />
  );
}
