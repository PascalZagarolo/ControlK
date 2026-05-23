import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { listRules } from '@/lib/actions/automations';
import { listWorkspaceMembers } from '@/lib/db/queries/members';
import { AutomationsClient } from '@/components/todos/automations-client';

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/settings/automations');
  const ws = await requireCurrentWorkspace();
  const [rules, members] = await Promise.all([listRules(), listWorkspaceMembers(ws.id)]);
  return <AutomationsClient rules={rules} members={members} />;
}
