import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, isNotNull } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { syncGmailForUser } from '@/lib/google/gmail-sync';

export const dynamic = 'force-dynamic';
// Vercel function timeout — the Hobby/Pro default of 300s is plenty
// for our serial-per-user fetch. If user count grows past ~100 we'll
// want to chunk the job; for now the simple loop is fine.
export const maxDuration = 300;

// modify is a superset of readonly; either qualifies the account for
// sync. We keep the broader filter so a user who upgrades to modify
// later doesn't accidentally get dropped from the cron.
const GMAIL_READ_SCOPES = new Set([
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
]);

/**
 * Vercel cron — every 5 min, walk every Google account that has both
 * a refresh token and the gmail.readonly scope, and run a sync.
 *
 * Errors per-account are logged and skipped so one user's broken
 * connection doesn't block everyone else's sync.
 *
 * Auth: when invoked by Vercel cron infrastructure, the request comes
 * in with Authorization: Bearer <CRON_SECRET> (the value of the
 * CRON_SECRET env var Vercel auto-injects). If CRON_SECRET is unset
 * the check is skipped — local dev / manual triggers still work.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
  }

  const db = getDb();

  const candidates = await db
    .select({
      userId: s.oauthAccounts.userId,
      scopes: s.oauthAccounts.scopes,
    })
    .from(s.oauthAccounts)
    .where(
      and(
        eq(s.oauthAccounts.provider, 'google'),
        isNotNull(s.oauthAccounts.refreshTokenEnc)
      )
    );

  const eligible = candidates.filter((c) =>
    (c.scopes ?? '').split(/\s+/).some((s) => GMAIL_READ_SCOPES.has(s))
  );

  let synced = 0;
  let failed = 0;
  for (const account of eligible) {
    const workspaceId = await firstWorkspaceForUser(account.userId);
    if (!workspaceId) {
      // User has Google connected but no workspace yet. Skip silently —
      // they'll get picked up on the next cron tick after onboarding.
      continue;
    }
    try {
      const res = await syncGmailForUser(account.userId, workspaceId);
      if (res.ok) {
        synced += 1;
      } else {
        failed += 1;
        console.warn(
          `[cron/sync-inboxes] user=${account.userId} skipped: ${res.reason}`
        );
      }
    } catch (e) {
      failed += 1;
      console.error(
        `[cron/sync-inboxes] user=${account.userId} threw:`,
        e instanceof Error ? e.message : e
      );
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: eligible.length,
    synced,
    failed,
  });
}

/**
 * Picks a workspace to sync this user's inbox into. For V1 we pick the
 * earliest-created membership — single-workspace users (the majority)
 * get the right answer trivially, and multi-workspace users can later
 * reassign via a settings toggle when we add one.
 */
async function firstWorkspaceForUser(userId: string): Promise<string | null> {
  const db = getDb();
  const membership = await db.query.workspaceMembers.findFirst({
    where: eq(s.workspaceMembers.userId, userId),
    columns: { workspaceId: true },
  });
  return membership?.workspaceId ?? null;
}
