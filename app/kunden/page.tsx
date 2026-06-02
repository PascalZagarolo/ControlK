import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import {
  listCustomerTags,
  listCustomersDetailed,
  smartCustomerCounts,
} from '@/lib/db/queries/customers';
import { listCustomerOverview } from '@/lib/db/queries/clients';
import { listWorkspaceMembers } from '@/lib/db/queries/members';
import { KundenListClient } from '@/components/customers/kunden-list-client';
import { KundenWedgeClient } from '@/components/customers/kunden-wedge-client';

export const dynamic = 'force-dynamic';

/**
 * /kunden serves two audiences off the same URL, decided by ws.rentalPack:
 *   • rentalPack workspaces  → the full fleet/contract CRM (unchanged).
 *   • wedge workspaces       → the calm, read-only customer OVERVIEW: a view
 *     onto what Ctrl+K already knows (open commitments, who's waiting, last
 *     contact) per tagged client. No CRM to maintain.
 */
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/kunden');
  const ws = await requireCurrentWorkspace();

  if (!ws.rentalPack) {
    const rows = await listCustomerOverview(ws.id, user.id);
    return <KundenWedgeClient rows={rows} />;
  }

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
