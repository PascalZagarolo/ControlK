'use server';

import { revalidatePath } from 'next/cache';
import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';

export type Tag = {
  id: string;
  name: string;
  slug: string;
  color?: string | null;
};

export type ExternalEventStatus =
  | 'prep_needed'
  | 'prepared'
  | 'follow_up_due'
  | 'completed'
  | null;

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

function slugifyTag(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64);
}

// Verifies that the calendar event belongs to the current user, and
// returns the workspace context for revalidation + tag-scope. The
// metadata is user-private so we don't need a workspace-membership
// check beyond "the event exists for this user".
async function authorizeEvent(
  eventId: string
): Promise<
  | { ok: true; userId: string; workspaceId: string }
  | { ok: false; error: string }
> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const event = await db.query.externalCalendarEvents.findFirst({
    where: and(
      eq(s.externalCalendarEvents.id, eventId),
      eq(s.externalCalendarEvents.userId, user.id)
    ),
    columns: { id: true },
  });
  if (!event) return { ok: false, error: 'Termin nicht gefunden.' };
  return { ok: true, userId: user.id, workspaceId: ws.id };
}

async function findOrCreateTag(workspaceId: string, rawName: string): Promise<Tag | null> {
  const name = rawName.trim();
  if (!name) return null;
  const slug = slugifyTag(name);
  if (!slug) return null;

  const db = getDb();
  const existing = await db.query.tags.findFirst({
    where: and(eq(s.tags.workspaceId, workspaceId), eq(s.tags.slug, slug)),
    columns: { id: true, name: true, slug: true, color: true },
  });
  if (existing) return existing;

  const inserted = await db
    .insert(s.tags)
    .values({ workspaceId, name, slug })
    .onConflictDoNothing({ target: [s.tags.workspaceId, s.tags.slug] })
    .returning({ id: s.tags.id, name: s.tags.name, slug: s.tags.slug, color: s.tags.color });
  if (inserted[0]) return inserted[0];

  const reread = await db.query.tags.findFirst({
    where: and(eq(s.tags.workspaceId, workspaceId), eq(s.tags.slug, slug)),
    columns: { id: true, name: true, slug: true, color: true },
  });
  return reread ?? null;
}

// Internal helper: ensure a metadata row exists for (event, user) so we
// can update fields without UPSERT noise. Returns the row id.
async function ensureMetadataRow(
  eventId: string,
  userId: string,
  workspaceId: string
): Promise<string> {
  const db = getDb();
  const existing = await db.query.externalEventMetadata.findFirst({
    where: and(
      eq(s.externalEventMetadata.calendarEventId, eventId),
      eq(s.externalEventMetadata.userId, userId)
    ),
    columns: { id: true },
  });
  if (existing) return existing.id;
  const [row] = await db
    .insert(s.externalEventMetadata)
    .values({ calendarEventId: eventId, userId, workspaceId })
    .returning({ id: s.externalEventMetadata.id });
  return row.id;
}

// ─── Notes ──────────────────────────────────────────────────────
export async function updateEventNote(
  eventId: string,
  markdown: string
): Promise<Result> {
  const auth = await authorizeEvent(eventId);
  if (!auth.ok) return auth;
  const trimmed = markdown.trim();
  const db = getDb();
  await ensureMetadataRow(eventId, auth.userId, auth.workspaceId);
  await db
    .update(s.externalEventMetadata)
    .set({
      noteMarkdown: trimmed.length === 0 ? null : trimmed,
      noteUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(s.externalEventMetadata.calendarEventId, eventId),
        eq(s.externalEventMetadata.userId, auth.userId)
      )
    );
  revalidatePath('/calendar/week');
  return { ok: true };
}

// ─── Status ─────────────────────────────────────────────────────
export async function updateEventStatus(
  eventId: string,
  status: ExternalEventStatus
): Promise<Result> {
  const auth = await authorizeEvent(eventId);
  if (!auth.ok) return auth;
  const db = getDb();
  await ensureMetadataRow(eventId, auth.userId, auth.workspaceId);
  await db
    .update(s.externalEventMetadata)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(s.externalEventMetadata.calendarEventId, eventId),
        eq(s.externalEventMetadata.userId, auth.userId)
      )
    );
  revalidatePath('/calendar/week');
  return { ok: true };
}

// ─── Tags ───────────────────────────────────────────────────────
export async function listWorkspaceTagsForEvents(): Promise<Tag[]> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const rows = await db.query.tags.findMany({
    where: eq(s.tags.workspaceId, ws.id),
    orderBy: [asc(s.tags.name)],
    columns: { id: true, name: true, slug: true, color: true },
  });
  return rows;
}

export async function listEventTags(eventId: string): Promise<Tag[]> {
  const auth = await authorizeEvent(eventId);
  if (!auth.ok) return [];
  const db = getDb();
  const rows = await db
    .select({
      id: s.tags.id,
      name: s.tags.name,
      slug: s.tags.slug,
      color: s.tags.color,
    })
    .from(s.externalEventTags)
    .innerJoin(s.tags, eq(s.tags.id, s.externalEventTags.tagId))
    .where(
      and(
        eq(s.externalEventTags.calendarEventId, eventId),
        eq(s.externalEventTags.userId, auth.userId)
      )
    )
    .orderBy(asc(s.tags.name));
  return rows;
}

export async function addEventTag(
  eventId: string,
  rawName: string
): Promise<Result<{ tag: Tag }>> {
  const auth = await authorizeEvent(eventId);
  if (!auth.ok) return auth;
  const tag = await findOrCreateTag(auth.workspaceId, rawName);
  if (!tag) return { ok: false, error: 'Tag-Name ist leer.' };
  const db = getDb();
  await db
    .insert(s.externalEventTags)
    .values({ calendarEventId: eventId, tagId: tag.id, userId: auth.userId })
    .onConflictDoNothing({
      target: [
        s.externalEventTags.calendarEventId,
        s.externalEventTags.tagId,
        s.externalEventTags.userId,
      ],
    });
  revalidatePath('/calendar/week');
  return { ok: true, tag };
}

export async function removeEventTag(
  eventId: string,
  tagId: string
): Promise<Result> {
  const auth = await authorizeEvent(eventId);
  if (!auth.ok) return auth;
  const db = getDb();
  await db
    .delete(s.externalEventTags)
    .where(
      and(
        eq(s.externalEventTags.calendarEventId, eventId),
        eq(s.externalEventTags.tagId, tagId),
        eq(s.externalEventTags.userId, auth.userId)
      )
    );
  revalidatePath('/calendar/week');
  return { ok: true };
}

// ─── Popover loader ─────────────────────────────────────────────
// Single batched fetch for everything the popover needs: metadata
// row (may not exist yet → null fields), event-specific tags, and the
// workspace tag dictionary for the picker autocomplete.
export type EventDetailLoad = {
  ok: true;
  status: ExternalEventStatus;
  noteMarkdown: string | null;
  noteUpdatedAt: string | null;
  recapMarkdown: string | null;
  tags: Tag[];
  workspaceTags: Tag[];
};

export async function loadEventDetail(
  eventId: string
): Promise<EventDetailLoad | { ok: false; error: string }> {
  const auth = await authorizeEvent(eventId);
  if (!auth.ok) return auth;
  const db = getDb();

  const [metaRow, eventTagRows, allTags] = await Promise.all([
    db.query.externalEventMetadata.findFirst({
      where: and(
        eq(s.externalEventMetadata.calendarEventId, eventId),
        eq(s.externalEventMetadata.userId, auth.userId)
      ),
      columns: {
        status: true,
        noteMarkdown: true,
        noteUpdatedAt: true,
        recapMarkdown: true,
      },
    }),
    db
      .select({
        id: s.tags.id,
        name: s.tags.name,
        slug: s.tags.slug,
        color: s.tags.color,
      })
      .from(s.externalEventTags)
      .innerJoin(s.tags, eq(s.tags.id, s.externalEventTags.tagId))
      .where(
        and(
          eq(s.externalEventTags.calendarEventId, eventId),
          eq(s.externalEventTags.userId, auth.userId)
        )
      )
      .orderBy(asc(s.tags.name)),
    db.query.tags.findMany({
      where: eq(s.tags.workspaceId, auth.workspaceId),
      orderBy: [asc(s.tags.name)],
      columns: { id: true, name: true, slug: true, color: true },
    }),
  ]);

  return {
    ok: true,
    status: (metaRow?.status as ExternalEventStatus) ?? null,
    noteMarkdown: metaRow?.noteMarkdown ?? null,
    noteUpdatedAt: metaRow?.noteUpdatedAt?.toISOString() ?? null,
    recapMarkdown: metaRow?.recapMarkdown ?? null,
    tags: eventTagRows,
    workspaceTags: allTags,
  };
}
