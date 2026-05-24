import 'server-only';

import { and, eq, inArray, sql } from 'drizzle-orm';
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
import {
  classifyMessage,
  resolveCustomerSenders,
} from './classify-inbox';
import { classifyNewDomains } from './classify-topic';

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

  // 2. Pull a batch of recent inbox messages + sent messages. Sent
  //    messages power the "Du wartest auf …" split view and the
  //    reply-detection pass below. Both lists are deduped at the
  //    upsert layer (same (source_type, source_id) key).
  const [inboxIds, sentIds] = await Promise.all([
    listInboxMessageIds(accessToken, {
      maxResults: INITIAL_FETCH_LIMIT,
      labelIds: ['INBOX'],
    }),
    listInboxMessageIds(accessToken, {
      maxResults: INITIAL_FETCH_LIMIT,
      labelIds: ['SENT'],
    }),
  ]);
  const allIds = Array.from(new Set([...inboxIds, ...sentIds].map((m) => m.id)));

  const parsed = await fetchAllMetadata(accessToken, allIds);
  const inserted = await upsertInboxItems(userId, workspaceId, parsed);

  // 3. Reply-detection pass — flag sent items as awaiting / not.
  await recomputeAwaitingFlags(workspaceId);

  // 4. AI topic classification — fire-and-forget for previously-unseen
  //    sender domains. Capped so cron passes stay predictable.
  await classifyNewDomains({ userId, workspaceId, parsed }).catch((e) =>
    console.warn('[gmail-sync] topic classify failed:', e)
  );

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
  // History API returns BOTH inbound and sent additions since the
  // last cursor, so we get the right mix automatically.
  const addedIds = Array.from(changes.addedIds).slice(0, INCREMENTAL_FETCH_LIMIT);
  const parsed = await fetchAllMetadata(accessToken, addedIds);
  const inserted = await upsertInboxItems(userId, workspaceId, parsed);

  // Reply-detection re-runs after every incremental pass so a brand-
  // new inbound reply immediately clears the awaiting-flag on the
  // corresponding sent item.
  if (parsed.length > 0 || changes.readStateChanges.size > 0) {
    await recomputeAwaitingFlags(workspaceId);
  }

  if (parsed.length > 0) {
    await classifyNewDomains({ userId, workspaceId, parsed }).catch((e) =>
      console.warn('[gmail-sync] topic classify failed:', e)
    );
  }

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

  // Pre-fetch which inbound senders match customer contacts so the
  // classifier can decide 'customer' vs 'promo/primary' deterministically.
  // Only inbound matters — for sent items the sender IS us.
  const inboundSenders = parsed
    .filter((m) => m.direction === 'inbox')
    .map((m) => m.senderEmail)
    .filter((e): e is string => !!e);
  const customerSet = await resolveCustomerSenders(workspaceId, inboundSenders);

  let inserted = 0;
  for (const m of parsed) {
    const isCustomerSender =
      m.direction === 'inbox' &&
      !!m.senderEmail &&
      customerSet.has(m.senderEmail.toLowerCase());
    const category = classifyMessage(m, isCustomerSender);

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
        recipientEmail: m.recipientEmail,
        subject: m.subject,
        preview: m.preview,
        receivedAt: m.receivedAt,
        isRead: m.isRead,
        direction: m.direction,
        category,
      })
      .onConflictDoUpdate({
        target: [s.inboxItems.sourceType, s.inboxItems.sourceId],
        // On conflict: only refresh fields that can legitimately change
        // (subject can be rewritten on rare occasions, read state and
        // preview/snippet routinely). Keep workspaceId/userId pinned to
        // their original assignment — moving an inbox item between
        // workspaces is a future feature, not a sync side-effect.
        // Direction can flip if Gmail re-labels (rare), so we refresh it.
        // Category re-runs because customer-match state may have
        // changed (new contact added, etc.).
        set: {
          subject: m.subject,
          preview: m.preview,
          isRead: m.isRead,
          direction: m.direction,
          recipientEmail: m.recipientEmail,
          category,
          updatedAt: new Date(),
        },
      });
    inserted += res.rowCount ?? 0;
  }
  return inserted;
}

/**
 * Recomputes awaits_their_reply for every SENT row in the workspace.
 *
 * Definition: a sent message awaits a reply when no other row in the
 * same thread has a received_at strictly greater than the sent
 * message's received_at. The "other" can be inbox OR sent (the user
 * sending a follow-up to themselves still counts as "moved on").
 *
 * Implemented as a single SET … = NOT EXISTS(…) update so we avoid
 * round-tripping per row. Cheap even for tens of thousands of rows.
 */
async function recomputeAwaitingFlags(workspaceId: string): Promise<void> {
  const db = getDb();
  // Drizzle's typed update doesn't surface the correlated-subquery
  // pattern cleanly, so we drop to raw SQL — workspace-scoped, idx-
  // backed via inbox_items_awaiting_idx + inbox_items_source_dedup_idx.
  await db.execute(sql`
    UPDATE inbox_items AS s
    SET awaits_their_reply = NOT EXISTS (
      SELECT 1 FROM inbox_items AS r
      WHERE r.workspace_id = s.workspace_id
        AND r.source_thread_id = s.source_thread_id
        AND r.received_at > s.received_at
        AND r.id <> s.id
    ),
    updated_at = NOW()
    WHERE s.workspace_id = ${workspaceId}
      AND s.direction = 'sent'
  `);
}
