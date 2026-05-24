import 'server-only';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';

// Shape consumed by the foyer's NotificationStack. Kept narrow so we
// don't ship the whole DB row to the client. `source` collapses the
// underlying source_type enum onto the three visual categories the
// stack renders (email / channel / mention).
export type FoyerInboxCard = {
  id: string;
  source: 'email' | 'channel' | 'mention';
  sourceLabel: string; // "Gmail", "Outlook", "#flotte", "Notizen"
  sender: string;
  preview: string;
  minAgo: number;
  href: string;
};

function categorize(sourceType: string): {
  source: FoyerInboxCard['source'];
  label: string;
} {
  switch (sourceType) {
    case 'email_gmail':
      return { source: 'email', label: 'Gmail' };
    case 'email_outlook':
      return { source: 'email', label: 'Outlook' };
    case 'slack':
      return { source: 'channel', label: 'Slack' };
    case 'calendar_invite':
      return { source: 'mention', label: 'Kalender' };
    default:
      return { source: 'email', label: sourceType };
  }
}

function relativeMinutes(received: Date): number {
  return Math.max(0, Math.round((Date.now() - received.getTime()) / 60_000));
}

/**
 * Top N unread, non-archived inbox items for the workspace, ordered
 * most-recent first. Powers the foyer's NotificationStack.
 *
 * We deliberately don't surface read OR archived items — the stack is
 * meant to be a "what's waiting on me" lens, not a history view.
 */
export async function listFoyerInboxCards(
  workspaceId: string,
  limit = 6
): Promise<FoyerInboxCard[]> {
  const db = getDb();
  const rows = await db.query.inboxItems.findMany({
    where: and(
      eq(s.inboxItems.workspaceId, workspaceId),
      eq(s.inboxItems.isRead, false),
      eq(s.inboxItems.isArchived, false),
      // Hide snoozed items until their wake-up time passes. NULL means
      // never snoozed, so always visible.
      or(
        isNull(s.inboxItems.snoozedUntil),
        sql`${s.inboxItems.snoozedUntil} <= now()`
      )
    ),
    orderBy: [desc(s.inboxItems.receivedAt)],
    limit,
    columns: {
      id: true,
      sourceType: true,
      senderName: true,
      subject: true,
      preview: true,
      receivedAt: true,
    },
  });
  return rows.map<FoyerInboxCard>((r) => {
    const { source, label } = categorize(r.sourceType);
    const previewText = r.preview?.trim() || r.subject?.trim() || '—';
    return {
      id: r.id,
      source,
      sourceLabel: label,
      sender: r.senderName,
      preview: previewText,
      minAgo: relativeMinutes(new Date(r.receivedAt)),
      href: `/inbox/${r.id}`,
    };
  });
}
