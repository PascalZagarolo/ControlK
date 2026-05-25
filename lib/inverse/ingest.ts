import 'server-only';

import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import type { ExternalCalendarAttendee } from '@/lib/db/schema';

// Real-time activity ingestion. Each function is called from the
// upstream insert site (gmail-sync, channel sendMessage, etc.) right
// after the source row lands in its own table.
//
// All inserts use onConflictDoNothing — the activity_log partial
// unique index on (user, source_type, source_id, entity_type,
// entity_id) makes re-runs safe. The cron-based backfill and these
// real-time hooks intentionally write the same shape so re-running
// either against historical data is a no-op for already-logged
// touches.
//
// All functions swallow errors and log to console. The whole point of
// activity_log is to be a passive observer — a broken activity hook
// must never break the user's actual write (sending a message,
// receiving an email).

function logError(label: string, e: unknown) {
  console.warn(`[inverse/ingest] ${label} failed:`, e instanceof Error ? e.message : e);
}

// ─── Calendar event (post-upsert) ───────────────────────────────
export async function ingestCalendarEventActivity(input: {
  userId: string;
  workspaceId: string | null;
  eventId: string;
  startAt: Date;
  attendees: ExternalCalendarAttendee[];
  organizerEmail: string | null;
}): Promise<void> {
  if (!input.workspaceId) return;
  try {
    const db = getDb();
    const me = await db.query.users.findFirst({
      where: eq(s.users.id, input.userId),
      columns: { email: true },
    });
    const myEmail = me?.email?.toLowerCase();
    const isOrganizer =
      !!myEmail && input.organizerEmail?.toLowerCase() === myEmail;

    for (const a of input.attendees) {
      const email = a.email?.toLowerCase();
      if (!email || email === myEmail) continue;
      await db
        .insert(s.activityLog)
        .values({
          workspaceId: input.workspaceId,
          userId: input.userId,
          activityKind: isOrganizer ? 'event_organized' : 'event_attended',
          entityType: 'person',
          entityId: email,
          entityDisplayName: a.name || a.email,
          sourceType: 'calendar_event',
          sourceId: input.eventId,
          weight: isOrganizer ? 5 : 4,
          occurredAt: input.startAt,
        })
        .onConflictDoNothing();
    }
  } catch (e) {
    logError('calendar', e);
  }
}

// ─── Inbox item (post-insert) ───────────────────────────────────
export async function ingestInboxItemActivity(input: {
  userId: string;
  workspaceId: string;
  itemId: string;
  direction: 'inbox' | 'sent';
  senderEmail: string | null;
  senderName: string | null;
  recipientEmail: string | null;
  receivedAt: Date;
}): Promise<void> {
  try {
    const db = getDb();
    if (input.direction === 'inbox' && input.senderEmail) {
      const email = input.senderEmail.toLowerCase();
      await db
        .insert(s.activityLog)
        .values({
          workspaceId: input.workspaceId,
          userId: input.userId,
          activityKind: 'email_received',
          entityType: 'person',
          entityId: email,
          entityDisplayName: input.senderName || input.senderEmail,
          sourceType: 'inbox_item',
          sourceId: input.itemId,
          weight: 1,
          occurredAt: input.receivedAt,
        })
        .onConflictDoNothing();
    } else if (input.direction === 'sent' && input.recipientEmail) {
      const email = input.recipientEmail.toLowerCase();
      await db
        .insert(s.activityLog)
        .values({
          workspaceId: input.workspaceId,
          userId: input.userId,
          activityKind: 'email_sent',
          entityType: 'person',
          entityId: email,
          entityDisplayName: email,
          sourceType: 'inbox_item',
          sourceId: input.itemId,
          weight: 3,
          occurredAt: input.receivedAt,
        })
        .onConflictDoNothing();
    }
  } catch (e) {
    logError('inbox', e);
  }
}

// ─── Channel message (post-insert) ──────────────────────────────
export async function ingestChannelMessageActivity(input: {
  userId: string;
  workspaceId: string;
  channelId: string;
  channelName: string;
  messageId: string;
  occurredAt: Date;
}): Promise<void> {
  try {
    const db = getDb();
    await db
      .insert(s.activityLog)
      .values({
        workspaceId: input.workspaceId,
        userId: input.userId,
        activityKind: 'channel_message_sent',
        entityType: 'channel',
        entityId: input.channelId,
        entityDisplayName: `#${input.channelName}`,
        sourceType: 'channel_message',
        sourceId: input.messageId,
        weight: 1,
        occurredAt: input.occurredAt,
      })
      .onConflictDoNothing();
  } catch (e) {
    logError('channel_sent', e);
  }
}

// Mention of a workspace member in a channel message → for that
// mentioned user, log a channel_message_received touch tagged to the
// author as the entity. (We track WHO mentioned them so the standstill
// engine treats it as a relationship signal.)
export async function ingestChannelMentionActivity(input: {
  mentionedUserId: string;
  workspaceId: string;
  authorUserId: string;
  authorEmail: string;
  authorName: string;
  messageId: string;
  occurredAt: Date;
}): Promise<void> {
  try {
    const db = getDb();
    await db
      .insert(s.activityLog)
      .values({
        workspaceId: input.workspaceId,
        userId: input.mentionedUserId,
        activityKind: 'channel_message_received',
        entityType: 'person',
        entityId: input.authorEmail.toLowerCase(),
        entityDisplayName: input.authorName,
        sourceType: 'channel_message',
        sourceId: input.messageId,
        weight: 1,
        occurredAt: input.occurredAt,
      })
      .onConflictDoNothing();
  } catch (e) {
    logError('channel_mention', e);
  }
}

// ─── Note mention (post-insert) ─────────────────────────────────
export async function ingestNoteMentionActivity(input: {
  userId: string;
  workspaceId: string;
  mentionRowId: string;
  mentionType: string;
  mentionId: string;
  label: string;
  occurredAt: Date;
}): Promise<void> {
  try {
    const db = getDb();
    let entityType: 'person' | 'customer' | 'note' | null = null;
    if (input.mentionType === 'user') entityType = 'person';
    else if (input.mentionType === 'customer') entityType = 'customer';
    else if (input.mentionType === 'note') entityType = 'note';
    if (!entityType) return;

    await db
      .insert(s.activityLog)
      .values({
        workspaceId: input.workspaceId,
        userId: input.userId,
        activityKind: 'note_mention',
        entityType,
        entityId: input.mentionId,
        entityDisplayName: input.label,
        sourceType: 'note_mention',
        sourceId: input.mentionRowId,
        weight: 2,
        occurredAt: input.occurredAt,
      })
      .onConflictDoNothing();
  } catch (e) {
    logError('note_mention', e);
  }
}
