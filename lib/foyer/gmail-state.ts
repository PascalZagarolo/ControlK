import 'server-only';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

export type GmailFoyerState = {
  /** True when the user has a refresh token AND the gmail.readonly scope. */
  connected: boolean;
  /** Last successful sync, ISO string. Null if never synced. */
  syncedAt: string | null;
};

/**
 * Slim lookup used by buildFoyerData to drive the NotificationStack's
 * empty/connect/skeleton branches. Returns connected=false on any
 * exception (DB hiccup, missing row, schema mismatch) so the foyer
 * never throws because of an integration query.
 */
export async function fetchGmailConnectionState(
  userId: string
): Promise<GmailFoyerState> {
  try {
    const db = getDb();
    const row = await db.query.oauthAccounts.findFirst({
      where: and(
        eq(s.oauthAccounts.userId, userId),
        eq(s.oauthAccounts.provider, 'google')
      ),
      columns: {
        refreshTokenEnc: true,
        scopes: true,
        gmailSyncedAt: true,
      },
    });
    if (!row || !row.refreshTokenEnc) {
      return { connected: false, syncedAt: null };
    }
    const scopes = (row.scopes ?? '').split(/\s+/).filter(Boolean);
    if (!scopes.includes(GMAIL_SCOPE)) {
      return { connected: false, syncedAt: null };
    }
    return {
      connected: true,
      syncedAt: row.gmailSyncedAt
        ? new Date(row.gmailSyncedAt).toISOString()
        : null,
    };
  } catch {
    return { connected: false, syncedAt: null };
  }
}
