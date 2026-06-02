import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { getCustomerFullBySlug } from '@/lib/db/queries/customer-detail';
import { listCustomerTags } from '@/lib/db/queries/customers';
import { getCustomerDetailByTag, getManualContactDetail } from '@/lib/db/queries/clients';
import { listContracts } from '@/lib/db/queries/contracts';
import { listWorkspaceMembers } from '@/lib/db/queries/members';
import { listTodoGroups } from '@/lib/db/queries/todo-groups';
import { listWorkflows } from '@/lib/db/queries/workflows';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { KundenDetailClient } from '@/components/customers/kunden-detail-client';
import { KundeWedgeDetailClient } from '@/components/customers/kunde-wedge-detail-client';
import { ManualContactDetailClient } from '@/components/customers/manual-contact-detail-client';
import { listBacklinksFor } from '@/lib/db/queries/note-backlinks';
import { BacklinksPanel } from '@/components/notes/backlinks-panel';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/sign-in?from=/kunden/${id}`);
  const ws = await requireCurrentWorkspace();

  // Wedge audience: the [id] param is either a contact_tag id (tagged client)
  // or a customers id (manual contact, business workspaces). rentalPack
  // workspaces fall through to the legacy CRM detail (slug-keyed) below.
  if (!ws.rentalPack) {
    const tagged = await getCustomerDetailByTag(ws.id, user.id, id);
    if (tagged) return <KundeWedgeDetailClient detail={tagged} />;
    // Manual contacts only exist in business workspaces.
    if (ws.scope === 'business') {
      const manual = await getManualContactDetail(ws.id, user.id, id);
      if (manual) return <ManualContactDetailClient detail={manual} />;
    }
    notFound();
  }

  const customer = await getCustomerFullBySlug(ws.id, id);
  if (!customer) notFound();

  const [allContracts, members, allTags, workflows, todoGroups, channelRows, vehicleRows, shareRows] =
    await Promise.all([
      listContracts(ws.id),
      listWorkspaceMembers(ws.id),
      listCustomerTags(ws.id),
      listWorkflows(ws.id),
      listTodoGroups(ws.id),
      // Linked channels with id
      (async () => {
        const db = getDb();
        const rows = await db
          .select({
            id: s.channels.id,
            slug: s.channels.slug,
            name: s.channels.name,
          })
          .from(s.customerChannels)
          .innerJoin(s.channels, eq(s.customerChannels.channelId, s.channels.id))
          .where(eq(s.customerChannels.customerId, customer.dbId!));
        return rows;
      })(),
      // Vehicles ever connected: contracts of this customer → vehicles via calendar events
      (async () => {
        const db = getDb();
        const rows = await db
          .selectDistinctOn([s.vehicles.id], {
            id: s.vehicles.id,
            externalId: s.vehicles.externalId,
            plate: s.vehicles.plate,
            model: s.vehicles.model,
          })
          .from(s.calendarEvents)
          .innerJoin(s.vehicles, eq(s.calendarEvents.linkedVehicleId, s.vehicles.id))
          .where(eq(s.calendarEvents.linkedCustomerId, customer.dbId!));
        return rows.map((v) => ({
          id: v.id,
          externalId: v.externalId ?? v.id,
          plate: v.plate,
          model: v.model,
        }));
      })(),
      // Share-Links
      (async () => {
        const db = getDb();
        const rows = await db.query.customerShareLinks.findMany({
          where: and(
            eq(s.customerShareLinks.workspaceId, ws.id),
            eq(s.customerShareLinks.customerId, customer.dbId!)
          ),
          orderBy: [s.customerShareLinks.createdAt],
        });
        return rows.map((l) => ({
          id: l.id,
          token: l.token,
          customerId: l.customerId,
          customerName: customer.name,
          expiresAt: l.expiresAt?.toISOString(),
          viewCount: l.viewCount,
          lastViewedAt: l.lastViewedAt?.toISOString(),
          createdAt: l.createdAt.toISOString(),
        }));
      })(),
    ]);

  const customerContracts = allContracts.filter((c) => c.customerId === customer.id);
  const backlinks = await listBacklinksFor(ws.id, 'customer', customer.id);

  return (
    <>
      <KundenDetailClient
        customer={customer}
        contracts={customerContracts}
        members={members}
        allTags={allTags}
        linkedChannels={channelRows}
        workflows={workflows}
        todoGroups={todoGroups}
        customerVehicles={vehicleRows}
        shareLinks={shareRows}
      />
      <div className="mx-auto w-full max-w-[1100px] px-4 pb-16 md:px-6">
        <BacklinksPanel backlinks={backlinks} />
      </div>
    </>
  );
}
