import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { getVehicleFullByExternalId } from '@/lib/db/queries/vehicle-detail';
import { listVehicleTags } from '@/lib/db/queries/vehicles';
import { listWorkspaceMembers } from '@/lib/db/queries/members';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { and, eq, asc } from 'drizzle-orm';
import { FlotteDetailClient } from '@/components/fleet/flotte-detail-client';
import { listBacklinksFor } from '@/lib/db/queries/note-backlinks';
import { BacklinksPanel } from '@/components/notes/backlinks-panel';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/sign-in?from=/flotte/${id}`);
  const ws = await requireCurrentWorkspace();

  const vehicle = await getVehicleFullByExternalId(ws.id, id);
  if (!vehicle) notFound();

  const db = getDb();
  const [members, tags, customers, shareLinks] = await Promise.all([
    listWorkspaceMembers(ws.id),
    listVehicleTags(ws.id),
    db.query.customers.findMany({
      where: eq(s.customers.workspaceId, ws.id),
      columns: { id: true, name: true },
      orderBy: [asc(s.customers.name)],
    }),
    db.query.vehicleShareLinks.findMany({
      where: and(
        eq(s.vehicleShareLinks.workspaceId, ws.id),
        eq(s.vehicleShareLinks.vehicleId, vehicle.dbId!)
      ),
      orderBy: [s.vehicleShareLinks.createdAt],
    }),
  ]);

  const backlinks = vehicle.dbId
    ? await listBacklinksFor(ws.id, 'vehicle', vehicle.dbId)
    : [];

  return (
    <>
      <FlotteDetailClient
        vehicle={vehicle}
        members={members}
        allTags={tags}
        customers={customers}
        shareLinks={shareLinks.map((l) => ({
          id: l.id,
          token: l.token,
          vehicleId: l.vehicleId ?? undefined,
          vehicleLabel: `${vehicle.plate} · ${vehicle.model}`,
          expiresAt: l.expiresAt?.toISOString(),
          viewCount: l.viewCount,
          lastViewedAt: l.lastViewedAt?.toISOString(),
          createdAt: l.createdAt.toISOString(),
        }))}
      />
      <div className="mx-auto w-full max-w-[1100px] px-4 pb-16 md:px-6">
        <BacklinksPanel backlinks={backlinks} />
      </div>
    </>
  );
}
