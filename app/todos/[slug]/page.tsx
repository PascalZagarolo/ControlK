import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { listTodos } from '@/lib/db/queries/todos';
import {
  countUngrouped,
  getTodoGroupBySlug,
  listTodoGroups,
  smartViewCounts,
} from '@/lib/db/queries/todo-groups';
import { listWorkspaceMembers } from '@/lib/db/queries/members';
import { listWorkflows } from '@/lib/db/queries/workflows';
import { listShareLinksForGroup } from '@/lib/db/queries/share-links';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { TodosClient } from '@/components/todos/todos-client';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await currentUser();
  if (!user) redirect(`/sign-in?from=/todos/${slug}`);
  const ws = await requireCurrentWorkspace();

  const group = await getTodoGroupBySlug(ws.id, slug);
  if (!group) notFound();

  const [todos, groups, members, smartCounts, ungroupedCount, workflows, shareLinks] =
    await Promise.all([
      listTodos(ws.id, user.id, { groupId: group.id }),
      listTodoGroups(ws.id),
      listWorkspaceMembers(ws.id),
      smartViewCounts(ws.id, user.id),
      countUngrouped(ws.id, user.id),
      listWorkflows(ws.id),
      listShareLinksForGroup(ws.id, group.id),
    ]);

  const db = getDb();
  const [customerRows, contractRows, vehicleRows, channelRows] = await Promise.all([
    db.query.customers.findMany({
      where: eq(s.customers.workspaceId, ws.id),
      columns: { id: true, slug: true, name: true },
    }),
    db.query.contracts.findMany({
      where: eq(s.contracts.workspaceId, ws.id),
      columns: { id: true, externalId: true, title: true },
    }),
    db.query.vehicles.findMany({
      where: eq(s.vehicles.workspaceId, ws.id),
      columns: { id: true, externalId: true, plate: true, model: true },
    }),
    db.query.channels.findMany({
      where: eq(s.channels.workspaceId, ws.id),
      columns: { id: true, slug: true, name: true },
    }),
  ]);

  const activeGroup = groups.find((g) => g.slug === slug);

  return (
    <TodosClient
      workspaceId={ws.id}
      todos={todos}
      groups={groups}
      smartCounts={smartCounts}
      ungroupedCount={ungroupedCount}
      members={members}
      customers={customerRows.map((c) => ({ dbId: c.id, slug: c.slug, name: c.name }))}
      contracts={contractRows.map((c) => ({
        dbId: c.id,
        externalId: c.externalId ?? c.id,
        title: c.title,
      }))}
      vehicles={vehicleRows.map((v) => ({
        dbId: v.id,
        externalId: v.externalId ?? v.id,
        label: `${v.plate} · ${v.model}`,
      }))}
      channels={channelRows.map((c) => ({ dbId: c.id, slug: c.slug, name: c.name }))}
      currentUser={{
        id: user.id,
        name: user.name,
        initials: user.initials,
        from: user.avatarFrom,
        to: user.avatarTo,
      }}
      activeGroup={activeGroup}
      workflows={workflows}
      shareLinks={shareLinks}
    />
  );
}
