import 'server-only';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';

export type Project = {
  id: string;
  workspaceId: string;
  slug: string;
  name: string;
  description?: string;
  color?: string;
  position: number;
  archived: boolean;
};

function toProject(row: any): Project {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    color: row.color ?? undefined,
    position: row.position ?? 0,
    archived: !!row.archivedAt,
  };
}

export async function listProjects(workspaceId: string): Promise<Project[]> {
  const db = getDb();
  const rows = await db.query.projects.findMany({
    where: and(eq(s.projects.workspaceId, workspaceId), isNull(s.projects.archivedAt)),
    orderBy: [asc(s.projects.position), asc(s.projects.name)],
  });
  return rows.map(toProject);
}

export async function getProjectBySlug(
  workspaceId: string,
  slug: string
): Promise<Project | null> {
  const db = getDb();
  const row = await db.query.projects.findFirst({
    where: and(eq(s.projects.workspaceId, workspaceId), eq(s.projects.slug, slug)),
  });
  return row ? toProject(row) : null;
}
