import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { getFlow } from '@/lib/db/queries/flows';
import { FlowDetailClient } from '@/components/flows/flow-detail-client';

export const dynamic = 'force-dynamic';

/**
 * Flow detail — /todos/flow/[id]. One data source (the flow todo + its step
 * todos), two views (Liste / Flow-Chart) chosen client-side.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/sign-in?from=/todos/flow/${id}`);
  const ws = await requireCurrentWorkspace();

  const flow = await getFlow(ws.id, id);
  if (!flow) notFound();

  return (
    <FlowDetailClient
      flow={{
        id: flow.id,
        title: flow.title,
        description: flow.description,
        steps: flow.resolved.steps,
        edges: flow.resolved.edges,
        commitments: flow.commitments,
        doneCount: flow.resolved.doneCount,
        totalCount: flow.resolved.totalCount,
        complete: flow.resolved.complete,
      }}
    />
  );
}
