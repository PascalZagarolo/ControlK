import 'server-only';

import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { getValidGoogleAccessToken } from '@/lib/auth/google-tokens';
import {
  GmailAuthError,
  getMessageMetadata,
  getProfile,
  listHistorySince,
  listInboxMessageIds,
  type ParsedGmailMessage,
} from './gmail';

// Hard cap on how many message details we fetch in one sync pass. Each
// detail is ~5 Gmail quota units; the per-user limit is 250 units/sec.
// 50 keeps us under the limit even with retries, and is enough for the
// first-run "show the last batch in the inbox" experience.
const INITIAL_FETCH_LIMIT = 50;
// Same cap applied to incremental history pulls — if the user got
// 200 emails since last sync, we still only persist the most recent 50.
const INCREMENTAL_FETCH_LIMIT = 50;

// Either of these satisfies "can call list/get on the Gmail API" —
// gmail.modify is a superset of gmail.readonly so we accept both.
const GMAIL_READ_SCOPES = new Set([
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
]);

export type SyncResult =
  | { ok: true; inserted: number; updated: number; deleted: number; mode: 'initial' | 'incremental' }
  | { ok: false; reason: 'not_connected' | 'no_scope' | 'auth' | 'error'; error?: string };

/**
 * Pulls the user's recent Gmail inbox into inbox_items.
 *
 * - First call ever for a connection: pulls the last 50 INBOX messages
 *   (unread first) and captures the current historyId as the cursor.
 * - Subsequent calls: asks Google's History API for changes since the
 *   stored cursor — messages added, deleted, or marked (un)read.
 *
 * Idempotent on the (source_type, source_id) dedup key, so re-running
 * never duplicates rows. Safe to call from both the manual-trigger
 * route and the cron loop.
 */
export async function syncGmailForUser(
  userId: string,
  workspaceId: string
): Promise<SyncResult> {
  const db = getDb();

  const account = await db.query.oauthAccounts.findFirst({
    where: and(
      eq(s.oauthAccounts.userId, userId),
      eq(s.oauthAccounts.provider, 'google')
    ),
    columns: {
      id: true,
      scopes: true,
      refreshTokenEnc: true,
      gmailHistoryId: true,
    },
  });
  if (!account || !account.refreshTokenEnc) {
    return { ok: false, reason: 'not_connected' };
  }
  const scopes = (account.scopes ?? '').split(/\s+/).filter(Boolean);
  if (!scopes.some((s) => GMAIL_READ_SCOPES.has(s))) {
    return { ok: false, reason: 'no_scope' };
  }

  const accessToken = await getValidGoogleAccessToken(userId);
  if (!accessToken) return { ok: false, reason: 'auth' };

  try {
    if (account.gmailHistoryId) {
      return await runIncrementalSync(
        userId,
        workspaceId,
        account.id,
        account.gmailHistoryId,
        accessToken
      );
    }
    return await runInitialSync(userId, workspaceId, account.id, accessToken);
  } catch (e) {
    if (e instanceof GmailAuthError) return { ok: false, reason: 'auth' };
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[gmail-sync] user=${userId} failed:`, msg);
    return { ok: false, reason: 'error', error: msg };
  }
}

async function runInitialSync(
  userId: string,
  workspaceId: string,
  oauthAccountId: string,
  accessToken: string
): Promise<SyncResult> {
  const db = getDb();

  // 1. Capture a baseline historyId BEFORE we list — guarantees we
  //    don't miss messages that arrive while we're fetching.
  const profile = await getProfile(accessToken);

  // 2. Pull a batch of recent inbox messages. Prefer unread for the
  //    first sync since that's what the foyer surfaces.
  const ids = await listInboxMessageIds(accessToken, {
    maxResults: INITIAL_FETCH_LIMIT,
    query: 'in:inbox',
  });

  const parsed = await fetchAllMetadata(accessToken, ids.map((m) => m.id));
  const inserted = await upsertInboxItems(userId, workspaceId, parsed);

  await db
    .update(s.oauthAccounts)
    .set({
      gmailHistoryId: profile.historyId,
      gmailSyncedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(s.oauthAccounts.id, oauthAccountId));

  return { ok: true, mode: 'initial', inserted, updated: 0, deleted: 0 };
}

async function runIncrementalSync(
  userId: string,
  workspaceId: string,
  oauthAccountId: string,
  startHistoryId: string,
  accessToken: string
): Promise<SyncResult> {
  const db = getDb();

  let changes;
  try {
    changes = await listHistorySince(accessToken, startHistoryId);
  } catch (e) {
    // Google returns 404 when the historyId is too old (typically >7
    // days of churn). The right recovery is a fresh initial sync.
    if (
      e instanceof Error &&
      /404|expired|out\sof\srange/i.test(e.message)
    ) {
      console.warn(
        `[gmail-sync] historyId expired for user ${userId}, falling back to initial sync`
      );
      await db
        .update(s.oauthAccounts)
        .set({ gmailHistoryId: null })
        .where(eq(s.oauthAccounts.id, oauthAccountId));
      return runInitialSync(userId, workspaceId, oauthAccountId, accessToken);
    }
    throw e;
  }

  // Cap the new-messages list — see INCREMENTAL_FETCH_LIMIT note.
  const addedIds = Array.from(changes.addedIds).slice(0, INCREMENTAL_FETCH_LIMIT);
  const parsed = await fetchAllMetadata(accessToken, addedIds);
  const inserted = await upsertInboxItems(userId, workspaceId, parsed);

  // Read-state flips — apply without re-fetching the message.
  let updated = 0;
  for (const [gmailId, isRead] of changes.readStateChanges) {
    const res = await db
      .update(s.inboxItems)
      .set({ isRead, updatedAt: new Date() })
      .where(
        and(
          eq(s.inboxItems.sourceType, 'email_gmail'),
          eq(s.inboxItems.sourceId, gmailId)
        )
      );
    updated += res.rowCount ?? 0;
  }

  // Deletions — soft archive locally so the user's history is preserved.
  let deleted = 0;
  if (changes.removedIds.size > 0) {
    const res = await db
      .update(s.inboxItems)
      .set({ isArchived: true, archivedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(s.inboxItems.sourceType, 'email_gmail'),
          inArray(s.inboxItems.sourceId, Array.from(changes.removedIds))
        )
      );
    deleted = res.rowCount ?? 0;
  }

  // Advance the cursor only if Google gave us a new one. If they didn't
  // (rare: empty history page with no historyId), keep the old cursor.
  await db
    .update(s.oauthAccounts)
    .set({
      gmailHistoryId: changes.newHistoryId ?? startHistoryId,
      gmailSyncedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(s.oauthAccounts.id, oauthAccountId));

  return { ok: true, mode: 'incremental', inserted, updated, deleted };
}

// Serial fetch (not Promise.all) to stay polite on Gmail's quota.
// 50 sequential calls @ ~150 ms each ≈ 7.5 s worst case, fine for
// a 5-min cron cadence. If we need to go faster later, batch with
// concurrency limit (e.g. 5 at a time).
async function fetchAllMetadata(
  accessToken: string,
  ids: string[]
): Promise<ParsedGmailMessage[]> {
  const out: ParsedGmailMessage[] = [];
  for (const id of ids) {
    const m = await getMessageMetadata(accessToken, id);
    if (m) out.push(m);
  }
  return out;
}

async function upsertInboxItems(
  userId: string,
  workspaceId: string,
  parsed: ParsedGmailMessage[]
): Promise<number> {
  if (parsed.length === 0) return 0;
  const db = getDb();
  let inserted = 0;
  for (const m of parsed) {
    const res = await db
      .insert(s.inboxItems)
      .values({
        workspaceId,
        userId,
        sourceType: 'email_gmail',
        sourceId: m.id,
        sourceThreadId: m.threadId,
        senderName: m.senderName,
        senderEmail: m.senderEmail,
        subject: m.subject,
        preview: m.preview,
        receivedAt: m.receivedAt,
        isRead: m.isRead,
      })
      .onConflictDoUpdate({
        target: [s.inboxItems.sourceType, s.inboxItems.sourceId],
        // On conflict: only refresh fields that can legitimately change
        // (subject can be rewritten on rare occasions, read state and
        // preview/snippet routinely). Keep workspaceId/userId pinned to
        // their original assignment — moving an inbox item between
        // workspaces is a future feature, not a sync side-effect.
        set: {
          subject: m.subject,
          preview: m.preview,
          isRead: m.isRead,
          updatedAt: new Date(),
        },
      });
    inserted += res.rowCount ?? 0;
  }
  return inserted;
}
