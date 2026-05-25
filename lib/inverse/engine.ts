import 'server-only';

import { and, desc, eq, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import {
  computeThresholdStats,
  DEFAULT_THRESHOLD_DAYS,
} from './threshold-math';
import type { ExternalCalendarAttendee } from '@/lib/db/schema';

// ─── Backfill from existing data ────────────────────────────────
// Idempotent: the activity_log_source_unique_idx partial unique
// constraint stops dupes on (user, source_type, source_id, entity_type,
// entity_id). Re-running this is safe.

type BackfillCounts = {
  calendarEvents: number;
  inboxItems: number;
  channelMessages: number;
  noteMentions: number;
};

export async function backfillActivityLog(userId: string): Promise<BackfillCounts> {
  const counts: BackfillCounts = {
    calendarEvents: 0,
    inboxItems: 0,
    channelMessages: 0,
    noteMentions: 0,
  };

  counts.calendarEvents = await backfillCalendarEvents(userId);
  counts.inboxItems = await backfillInboxItems(userId);
  counts.channelMessages = await backfillChannelMessages(userId);
  counts.noteMentions = await backfillNoteMentions(userId);

  return counts;
}

async function backfillCalendarEvents(userId: string): Promise<number> {
  const db = getDb();
  const events = await db.query.externalCalendarEvents.findMany({
    where: eq(s.externalCalendarEvents.userId, userId),
    columns: {
      id: true,
      workspaceId: true,
      startAt: true,
      attendees: true,
      organizerEmail: true,
      title: true,
    },
  });

  const user = await db.query.users.findFirst({
    where: eq(s.users.id, userId),
    columns: { email: true },
  });
  const myEmail = user?.email?.toLowerCase();

  let inserted = 0;
  for (const ev of events) {
    if (!ev.workspaceId) continue;
    const attendees = (ev.attendees as ExternalCalendarAttendee[]) ?? [];
    const isOrganizer =
      !!myEmail && ev.organizerEmail?.toLowerCase() === myEmail;
    for (const a of attendees) {
      const aEmail = a.email?.toLowerCase();
      if (!aEmail || aEmail === myEmail) continue;
      try {
        await db
          .insert(s.activityLog)
          .values({
            workspaceId: ev.workspaceId,
            userId,
            activityKind: isOrganizer ? 'event_organized' : 'event_attended',
            entityType: 'person',
            entityId: aEmail,
            entityDisplayName: a.name || a.email,
            sourceType: 'calendar_event',
            sourceId: ev.id,
            weight: isOrganizer ? 5 : 4,
            occurredAt: ev.startAt,
          })
          .onConflictDoNothing();
        inserted += 1;
      } catch (e) {
        // Race/dup at the partial index — ignore
      }
    }
  }
  return inserted;
}

async function backfillInboxItems(userId: string): Promise<number> {
  const db = getDb();
  const items = await db.query.inboxItems.findMany({
    where: eq(s.inboxItems.userId, userId),
    columns: {
      id: true,
      workspaceId: true,
      senderEmail: true,
      senderName: true,
      recipientEmail: true,
      receivedAt: true,
      direction: true,
    },
  });

  let inserted = 0;
  for (const it of items) {
    // Inbound: someone wrote to me → log them as the entity.
    if (it.direction === 'inbox' && it.senderEmail) {
      const email = it.senderEmail.toLowerCase();
      await db
        .insert(s.activityLog)
        .values({
          workspaceId: it.workspaceId,
          userId,
          activityKind: 'email_received',
          entityType: 'person',
          entityId: email,
          entityDisplayName: it.senderName || it.senderEmail,
          sourceType: 'inbox_item',
          sourceId: it.id,
          weight: 1,
          occurredAt: it.receivedAt,
        })
        .onConflictDoNothing();
      inserted += 1;
    }
    // Outbound: I wrote to someone → log the recipient as the entity.
    if (it.direction === 'sent' && it.recipientEmail) {
      const email = it.recipientEmail.toLowerCase();
      await db
        .insert(s.activityLog)
        .values({
          workspaceId: it.workspaceId,
          userId,
          activityKind: 'email_sent',
          entityType: 'person',
          entityId: email,
          entityDisplayName: email,
          sourceType: 'inbox_item',
          sourceId: it.id,
          weight: 3,
          occurredAt: it.receivedAt,
        })
        .onConflictDoNothing();
      inserted += 1;
    }
  }
  return inserted;
}

async function backfillChannelMessages(userId: string): Promise<number> {
  const db = getDb();
  // Only the user's OWN messages — that proves they sent into the
  // channel. Mentions of the user by others get added when we wire
  // the channel-mention hook (next pass).
  const rows = await db
    .select({
      id: s.messages.id,
      channelId: s.messages.channelId,
      createdAt: s.messages.createdAt,
      channelName: s.channels.name,
      workspaceId: s.channels.workspaceId,
    })
    .from(s.messages)
    .innerJoin(s.channels, eq(s.channels.id, s.messages.channelId))
    .where(and(eq(s.messages.authorId, userId), isNull(s.messages.deletedAt)));

  let inserted = 0;
  for (const r of rows) {
    await db
      .insert(s.activityLog)
      .values({
        workspaceId: r.workspaceId,
        userId,
        activityKind: 'channel_message_sent',
        entityType: 'channel',
        entityId: r.channelId,
        entityDisplayName: `#${r.channelName}`,
        sourceType: 'channel_message',
        sourceId: r.id,
        weight: 1,
        occurredAt: r.createdAt,
      })
      .onConflictDoNothing();
    inserted += 1;
  }
  return inserted;
}

async function backfillNoteMentions(userId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({
      id: s.noteMentions.id,
      noteId: s.noteMentions.noteId,
      mentionType: s.noteMentions.mentionType,
      mentionId: s.noteMentions.mentionId,
      label: s.noteMentions.label,
      createdAt: s.noteMentions.createdAt,
      workspaceId: s.notes.workspaceId,
    })
    .from(s.noteMentions)
    .innerJoin(s.notes, eq(s.notes.id, s.noteMentions.noteId))
    .where(eq(s.notes.createdById, userId));

  let inserted = 0;
  for (const r of rows) {
    // Map note-mention-type to inverse-calendar entity type.
    // Notes module's mention enum includes 'user' (person), 'customer',
    // 'contract', 'vehicle', 'note' etc. We only track person + customer
    // + note here — others aren't standstill candidates.
    const t = r.mentionType as string;
    let entityType: 'person' | 'customer' | 'note' | null = null;
    if (t === 'user') entityType = 'person';
    else if (t === 'customer') entityType = 'customer';
    else if (t === 'note') entityType = 'note';
    if (!entityType) continue;

    await db
      .insert(s.activityLog)
      .values({
        workspaceId: r.workspaceId,
        userId,
        activityKind: 'note_mention',
        entityType,
        entityId: r.mentionId,
        entityDisplayName: r.label,
        sourceType: 'note_mention',
        sourceId: r.id,
        weight: 2,
        occurredAt: r.createdAt,
      })
      .onConflictDoNothing();
    inserted += 1;
  }
  return inserted;
}

// ─── Threshold computation ──────────────────────────────────────

export async function computeThresholdsForUser(
  userId: string
): Promise<{ entities: number }> {
  const db = getDb();

  // Group activity_log by (workspace, entity_type, entity_id, display)
  // to drive the threshold table. SQL aggregate keeps the query cheap;
  // we then load per-entity timestamps in a bounded inner loop.
  const groups = await db
    .select({
      workspaceId: s.activityLog.workspaceId,
      entityType: s.activityLog.entityType,
      entityId: s.activityLog.entityId,
      displayName: sql<string>`MAX(${s.activityLog.entityDisplayName})`,
    })
    .from(s.activityLog)
    .where(eq(s.activityLog.userId, userId))
    .groupBy(
      s.activityLog.workspaceId,
      s.activityLog.entityType,
      s.activityLog.entityId
    );

  let touched = 0;
  for (const g of groups) {
    // Pull the full timestamp list for this entity. Could cap to last
    // 200 interactions if a user has noisy entities (mailing lists),
    // but for V1 we let it run unbounded.
    const stampsRows = await db
      .select({ occurredAt: s.activityLog.occurredAt })
      .from(s.activityLog)
      .where(
        and(
          eq(s.activityLog.userId, userId),
          eq(s.activityLog.workspaceId, g.workspaceId),
          eq(s.activityLog.entityType, g.entityType),
          eq(s.activityLog.entityId, g.entityId)
        )
      );

    const stats = computeThresholdStats(
      g.entityType,
      stampsRows.map((r) => r.occurredAt)
    );

    await db
      .insert(s.entityThresholds)
      .values({
        userId,
        workspaceId: g.workspaceId,
        entityType: g.entityType,
        entityId: g.entityId,
        entityDisplayName: g.displayName,
        totalInteractions: stats.totalInteractions,
        firstInteractionAt: stats.firstInteractionAt,
        lastInteractionAt: stats.lastInteractionAt,
        medianDaysBetween: stats.medianDaysBetween,
        iqrDaysBetween: stats.iqrDaysBetween,
        alertThresholdDays: stats.alertThresholdDays,
        importanceScore: stats.importanceScore,
      })
      .onConflictDoUpdate({
        target: [
          s.entityThresholds.userId,
          s.entityThresholds.entityType,
          s.entityThresholds.entityId,
        ],
        set: {
          workspaceId: g.workspaceId,
          entityDisplayName: g.displayName,
          totalInteractions: stats.totalInteractions,
          firstInteractionAt: stats.firstInteractionAt,
          lastInteractionAt: stats.lastInteractionAt,
          medianDaysBetween: stats.medianDaysBetween,
          iqrDaysBetween: stats.iqrDaysBetween,
          alertThresholdDays: stats.alertThresholdDays,
          importanceScore: stats.importanceScore,
          updatedAt: new Date(),
        },
      });
    touched += 1;
  }
  return { entities: touched };
}

// ─── Standstill detection ───────────────────────────────────────

export async function detectStandstillsForUser(
  userId: string
): Promise<{ entered: number; resolved: number }> {
  const db = getDb();
  const now = new Date();

  // Skip muted + indefinitely-muted entities. The cron treats them as
  // dormant; they only re-enter the loop if user un-mutes.
  const rows = await db.query.entityThresholds.findMany({
    where: and(
      eq(s.entityThresholds.userId, userId),
      eq(s.entityThresholds.isMuted, false),
      or(
        isNull(s.entityThresholds.mutedUntil),
        lt(s.entityThresholds.mutedUntil, now)
      )!
    ),
  });

  let entered = 0;
  let resolved = 0;

  for (const r of rows) {
    if (!r.lastInteractionAt) continue;
    const daysSilent =
      (now.getTime() - r.lastInteractionAt.getTime()) / 86_400_000;
    const threshold = r.userSetThreshold ?? r.alertThresholdDays;
    const inStandstill = daysSilent >= threshold;

    if (inStandstill && !r.isInStandstill) {
      await db
        .update(s.entityThresholds)
        .set({
          isInStandstill: true,
          standstillSince: r.lastInteractionAt,
          updatedAt: now,
        })
        .where(eq(s.entityThresholds.id, r.id));
      entered += 1;
    } else if (!inStandstill && r.isInStandstill) {
      await db
        .update(s.entityThresholds)
        .set({
          isInStandstill: false,
          standstillSince: null,
          lastAcknowledgedAt: null,
          updatedAt: now,
        })
        .where(eq(s.entityThresholds.id, r.id));
      resolved += 1;
    }
  }

  return { entered, resolved };
}
