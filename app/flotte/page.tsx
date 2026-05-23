import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import {
  listVehicleTags,
  listVehiclesDetailed,
  smartVehicleCounts,
} from '@/lib/db/queries/vehicles';
import { listWorkspaceMembers } from '@/lib/db/queries/members';
import { FlotteListClient } from '@/components/fleet/flotte-list-client';

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/flotte');
  const ws = await requireCurrentWorkspace();

  const [vehicles, tags, members, counts] = await Promise.all([
    listVehiclesDetailed(ws.id),
    listVehicleTags(ws.id),
    listWorkspaceMembers(ws.id),
    smartVehicleCounts(ws.id, user.id),
  ]);

  return (
    <FlotteListClient
      vehicles={vehicles}
      members={members}
      tags={tags}
      currentUserId={user.id}
      counts={counts}
    />
  );
}
