import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import {
  listCustomerTags,
  listCustomersDetailed,
  smartCustomerCounts,
} from '@/lib/db/queries/customers';
import { listWorkspaceMembers } from '@/lib/db/queries/members';
import { KundenListClient } from '@/components/customers/kunden-list-client';

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/kunden');
  const ws = await requireCurrentWorkspace();

  const [customers, tags, members, counts] = await Promise.all([
    listCustomersDetailed(ws.id),
    listCustomerTags(ws.id),
    listWorkspaceMembers(ws.id),
    smartCustomerCounts(ws.id, user.id),
  ]);

  return (
    <KundenListClient
      customers={customers}
      members={members}
      tags={tags}
      currentUserId={user.id}
      counts={counts}
    />
  );
}
