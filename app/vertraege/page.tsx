import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import {
  getRevenueStack,
  listContractsDetailed,
  smartContractCounts,
} from '@/lib/db/queries/contracts';
import { listCustomers } from '@/lib/db/queries/customers';
import { listWorkspaceMembers } from '@/lib/db/queries/members';
import { VertraegeListClient } from '@/components/contracts/vertraege-list-client';

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/vertraege');
  const ws = await requireCurrentWorkspace();

  const [contracts, customers, members, counts, revenueStack] = await Promise.all([
    listContractsDetailed(ws.id),
    listCustomers(ws.id),
    listWorkspaceMembers(ws.id),
    smartContractCounts(ws.id, user.id),
    getRevenueStack(ws.id),
  ]);

  return (
    <VertraegeListClient
      contracts={contracts}
      customers={customers.map((c) => ({ slug: c.id, name: c.name }))}
      members={members}
      counts={counts}
      revenueStack={revenueStack}
      currentUserId={user.id}
    />
  );
}
