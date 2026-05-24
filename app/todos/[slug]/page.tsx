import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { listTodos } from '@/lib/db/queries/todos';
import { getTodoGroupBySlug } from '@/lib/db/queries/todo-groups';
import { listProjects } from '@/lib/db/queries/projects';
import { TodoGroupDetailClient } from '@/components/todos-v2/todo-group-detail-client';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await currentUser();
  if (!user) redirect(`/sign-in?from=/todos/${slug}`);
  const ws = await requireCurrentWorkspace();

  const group = await getTodoGroupBySlug(ws.id, slug);
  if (!group) notFound();

  const [todos, projects] = await Promise.all([
    listTodos(ws.id, user.id, { groupId: group.id }),
    listProjects(ws.id),
  ]);

  // Resolve the project this group belongs to (if any) — we need it for the
  // breadcrumb and the "project label" in the header. group.projectId is on
  // the row only if it was set; not all groups have one.
  const project =
    (group as any).projectId
      ? projects.find((p) => p.id === (group as any).projectId) ?? null
      : null;

  const open = todos.filter(
    (t) => t.status === 'offen' || t.status === 'in_arbeit'
  );
  const done = todos.filter((t) => t.status === 'erledigt');

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000);
  const dueToday = open.filter(
    (t) => t.dueAt && new Date(t.dueAt) >= startOfDay && new Date(t.dueAt) < endOfDay
  ).length;

  return (
    <TodoGroupDetailClient
      group={{
        id: group.id,
        slug: group.slug,
        name: group.name,
        description: group.description ?? undefined,
        emoji: group.emoji ?? undefined,
        projectId: project?.id ?? null,
        projectName: project?.name,
        projectSlug: project?.slug,
      }}
      openTodos={open.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueAt: t.dueAt ?? null,
        description: t.description ?? undefined,
      }))}
      doneTodos={done.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueAt: t.dueAt ?? null,
      }))}
      stats={{
        open: open.length,
        done: done.length,
        dueToday,
      }}
    />
  );
}
