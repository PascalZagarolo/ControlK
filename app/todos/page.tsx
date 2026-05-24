import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { listProjects } from '@/lib/db/queries/projects';
import { listTodoOverviewGroups } from '@/lib/db/queries/todo-overview';
import { TodosOverviewClient } from '@/components/todos-v2/todos-overview-client';

export const dynamic = 'force-dynamic';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/todos');
  const ws = await requireCurrentWorkspace();
  const sp = await searchParams;

  const [projects, allGroups] = await Promise.all([
    listProjects(ws.id),
    listTodoOverviewGroups(ws.id),
  ]);

  // Resolve the active project filter from the slug.
  const activeProjectSlug = sp.project ?? null;
  const activeProject = activeProjectSlug
    ? projects.find((p) => p.slug === activeProjectSlug) ?? null
    : null;

  // Server-side filter; we already have all groups for this workspace and
  // each carries its projectId, so this is a quick array filter — no second
  // query needed.
  const groups = !activeProjectSlug
    ? allGroups
    : activeProjectSlug === 'workspace'
      ? allGroups.filter((g) => !g.projectId)
      : activeProject
        ? allGroups.filter((g) => g.projectId === activeProject.id)
        : allGroups;

  // Aggregate stats across the (filtered) groups for the module header.
  const totalGroups = groups.length;
  const totalOpen = groups.reduce((sum, g) => sum + g.openCount, 0);
  const totalDueWeek = groups.reduce((sum, g) => sum + g.dueTodayCount, 0); // simplification — could split by week later

  return (
    <TodosOverviewClient
      projects={projects}
      groups={groups}
      activeProjectSlug={activeProjectSlug}
      stats={{
        groups: totalGroups,
        open: totalOpen,
        dueWeek: totalDueWeek,
      }}
    />
  );
}
