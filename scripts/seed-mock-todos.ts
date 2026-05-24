/**
 * Seeds 12 realistic mock todos into a given workspace + group so the
 * detail page can be eyeballed at production density. Mix of priorities
 * (hoch / mittel / niedrig / urgent), due dates (heute / morgen / diese
 * Woche / kein Datum / überfällig), and a handful pre-completed so the
 * "Erledigt" collapse has content too.
 *
 * Run once locally:
 *   tsx scripts/seed-mock-todos.ts <workspace-slug> <group-slug>
 *
 * Defaults to (workspace=urent, group=kundenakquise) if nothing passed.
 * Idempotent on titles: skips inserts that already exist by title in
 * the same group, so re-running is safe.
 */

import 'dotenv/config';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';

type MockTodo = {
  title: string;
  description?: string;
  priority: 'niedrig' | 'mittel' | 'hoch' | 'urgent';
  dueOffsetDays: number | null; // null = no date; negative = overdue; 0 = today; 1 = morgen
  done?: boolean;
};

const MOCKS: MockTodo[] = [
  {
    title: 'Anthropic API Key anbinden',
    description: 'Server-side env var setup. Test mit einem einfachen prompt.',
    priority: 'hoch',
    dueOffsetDays: 0,
  },
  {
    title: 'Müller GmbH — Q4 Vertrag finalisieren',
    description: 'Vier offene Klauseln; Anwalt schickt Markup spätestens Donnerstag.',
    priority: 'urgent',
    dueOffsetDays: 1,
  },
  {
    title: 'Onboarding-Flow Wireframes durchgehen',
    priority: 'mittel',
    dueOffsetDays: 3,
  },
  {
    title: 'Anna anrufen wegen Q1 Roadmap',
    priority: 'hoch',
    dueOffsetDays: -2, // overdue
  },
  {
    title: 'LinkedIn-Post planen — Fleet OS Launch',
    description: 'Bilder bei Marie anfragen.',
    priority: 'mittel',
    dueOffsetDays: 5,
  },
  {
    title: 'Steuerunterlagen Q3 sortieren',
    priority: 'niedrig',
    dueOffsetDays: 14,
  },
  {
    title: 'Niklas Feedback zur Übergabe-Vorlage einbauen',
    priority: 'mittel',
    dueOffsetDays: 2,
  },
  {
    title: 'Hetzner-Backup-Strategy reviewen',
    description: 'Sind die Snapshot-Intervalle noch wie gewollt?',
    priority: 'niedrig',
    dueOffsetDays: null, // no date
  },
  {
    title: 'Demo-Termin mit Schmidt+Partner vorbereiten',
    priority: 'hoch',
    dueOffsetDays: 0,
  },
  {
    title: 'Wochenrückblick schreiben',
    priority: 'niedrig',
    dueOffsetDays: 4,
  },
  // Two pre-completed
  {
    title: 'Domain-Renewal für urent.app eingerichtet',
    priority: 'mittel',
    dueOffsetDays: -1,
    done: true,
  },
  {
    title: 'Postmark Inbound DNS gesetzt',
    priority: 'niedrig',
    dueOffsetDays: -3,
    done: true,
  },
];

async function main() {
  const [, , wsSlugArg, groupSlugArg] = process.argv;
  const wsSlug = wsSlugArg ?? 'urent';
  const groupSlug = groupSlugArg ?? 'kundenakquise';

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set. Source your .env first.');
    process.exit(1);
  }

  const db = getDb();

  // Resolve workspace
  const ws = await db.query.workspaces.findFirst({
    where: eq(s.workspaces.slug, wsSlug),
  });
  if (!ws) {
    console.error(`Workspace not found: ${wsSlug}`);
    process.exit(1);
  }

  // Resolve group
  const group = await db.query.todoGroups.findFirst({
    where: and(eq(s.todoGroups.workspaceId, ws.id), eq(s.todoGroups.slug, groupSlug)),
  });
  if (!group) {
    console.error(`Group not found: ${groupSlug} in workspace ${wsSlug}`);
    process.exit(1);
  }

  // Resolve owner — needed for created_by_id NOT NULL constraint
  const owner = await db.query.users.findFirst({
    where: eq(s.users.id, ws.ownerId),
  });
  if (!owner) {
    console.error(`Workspace owner user not found: ${ws.ownerId}`);
    process.exit(1);
  }

  console.log(`Seeding into ${ws.slug} / ${group.slug} (owner: ${owner.email})`);

  // Skip titles that already exist in this group (idempotent re-run)
  const titles = MOCKS.map((m) => m.title);
  const existing = await db.query.todos.findMany({
    where: and(eq(s.todos.workspaceId, ws.id), eq(s.todos.groupId, group.id), inArray(s.todos.title, titles)),
    columns: { title: true },
  });
  const existingTitles = new Set(existing.map((t) => t.title));
  const toInsert = MOCKS.filter((m) => !existingTitles.has(m.title));

  if (toInsert.length === 0) {
    console.log('All mock titles already present. Nothing to insert.');
    return;
  }

  const now = new Date();
  const rows = toInsert.map((m) => {
    const dueAt =
      m.dueOffsetDays === null
        ? null
        : (() => {
            const d = new Date(now);
            d.setHours(12, 0, 0, 0);
            d.setDate(d.getDate() + m.dueOffsetDays);
            return d;
          })();
    return {
      workspaceId: ws.id,
      groupId: group.id,
      projectId: (group as any).projectId ?? null,
      createdById: owner.id,
      title: m.title,
      description: m.description ?? null,
      status: (m.done ? 'erledigt' : 'offen') as any,
      priority: m.priority as any,
      visibility: 'team' as any,
      dueAt,
      completedAt: m.done ? new Date() : null,
    };
  });

  await db.insert(s.todos).values(rows);

  console.log(`Inserted ${rows.length} todos.`);
  console.log(`Skipped ${existing.length} that already existed.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
