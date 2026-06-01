import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { buildMorningPlan } from '@/lib/morning-plan/build';
import { MorningPlanClient } from '@/components/morning-plan/morning-plan-client';

export const dynamic = 'force-dynamic';

/**
 * Morgen-Plan — the one surface the user opens to get their day planned.
 *
 * A SYNTHESIS over the upstream sources (triage, commitments, calendar,
 * todos), not a tab of lists: the deterministic engine (lib/morning-plan)
 * ranks one prioritised stream and computes cross-source collisions; an
 * optional LLM step only phrases the header. Items/order/collisions are all
 * computed from real data — the LLM invents nothing.
 */
export default async function PlanPage() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/plan');
  const ws = await requireCurrentWorkspace();

  const plan = await buildMorningPlan(ws.id, user.id, { withSummary: true });
  const firstName = user.name?.split(' ')[0] || user.name || 'da';

  return <MorningPlanClient plan={plan} firstName={firstName} />;
}
