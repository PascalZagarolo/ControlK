import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { getContractFullByExternalId } from '@/lib/db/queries/contracts';
import { listWorkspaceMembers } from '@/lib/db/queries/members';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { and, asc, desc, eq } from 'drizzle-orm';
import { VertraegeDetailClient } from '@/components/contracts/vertraege-detail-client';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/sign-in?from=/vertraege/${id}`);
  const ws = await requireCurrentWorkspace();

  const contract = await getContractFullByExternalId(ws.id, id);
  if (!contract) notFound();

  const db = getDb();
  const [members, vehicles, channelRows, shareLinks] = await Promise.all([
    listWorkspaceMembers(ws.id),
    db.query.vehicles.findMany({
      where: eq(s.vehicles.workspaceId, ws.id),
      columns: { id: true, externalId: true, plate: true, model: true },
      orderBy: [asc(s.vehicles.plate)],
    }),
    contract.customerDbId
      ? db
          .select({
            id: s.channels.id,
            slug: s.channels.slug,
            name: s.channels.name,
          })
          .from(s.customerChannels)
          .innerJoin(s.channels, eq(s.customerChannels.channelId, s.channels.id))
          .where(eq(s.customerChannels.customerId, contract.customerDbId))
      : Promise.resolve(
          await db
            .select({ id: s.channels.id, slug: s.channels.slug, name: s.channels.name })
            .from(s.channels)
            .where(eq(s.channels.workspaceId, ws.id))
            .limit(10)
        ),
    db.query.contractShareLinks.findMany({
      where: and(
        eq(s.contractShareLinks.workspaceId, ws.id),
        eq(s.contractShareLinks.contractId, contract.dbId!)
      ),
      orderBy: [desc(s.contractShareLinks.createdAt)],
    }),
  ]);

  return (
    <VertraegeDetailClient
      contract={contract}
      members={members}
      vehicles={vehicles.map((v) => ({
        id: v.id,
        externalId: v.externalId ?? v.id,
        plate: v.plate,
        model: v.model,
      }))}
      channels={channelRows}
      shareLinks={shareLinks.map((l) => ({
        id: l.id,
        token: l.token,
        contractId: l.contractId,
        contractTitle: contract.title,
        allowSignature: l.allowSignature === 1,
        expiresAt: l.expiresAt?.toISOString(),
        viewCount: l.viewCount,
        lastViewedAt: l.lastViewedAt?.toISOString(),
        createdAt: l.createdAt.toISOString(),
      }))}
    />
  );
}
