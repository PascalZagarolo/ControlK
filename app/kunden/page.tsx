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
 * /kunden serves three audiences off the same URL:
 *   • rentalPack workspaces      → the full fleet/contract CRM (unchanged).
 *   • business wedge workspaces  → the calm customer OVERVIEW: tagged clients
 *     (per-user) + manually-created shared contacts, with computed urgency.
 *   • solo/private workspaces    → module hidden (the tool stays schlank) →
 *     redirect home. The /inbox/clients lenses remain available there.
 */
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/kunden');
  const ws = await requireCurrentWorkspace();

  if (!ws.rentalPack) {
    // Business-Gate: Kontakt-/Kundenmanagement nur in Business-Workspaces.
    if (ws.scope !== 'business') redirect('/');
    const rows = await listCustomerOverview(ws.id, user.id, { includeManual: true });
    return <KundenWedgeClient rows={rows} canCreate />;
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
