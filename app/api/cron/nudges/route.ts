import { NextResponse, type NextRequest } from 'next/server';
import { eq, asc, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { buildMorningPlan } from '@/lib/morning-plan/build';
import { sendPushToUser, pushConfigured } from '@/lib/push/web-push';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Don't re-nudge a user within this window — guards against a cron retry or an
// accidental double-run sending the morning push twice.
const NUDGE_COOLDOWN_MS = 20 * 60 * 60 * 1000;

/**
 * Daily morning nudge (Web-Push). For every user with a push subscription,
 * build today's plan and — only when something actually needs attention —
 * send ONE calm summary ("2 Zusagen heute fällig · Thomas wartet seit 5 Tagen").
 * Calm days get no push. Runs once a morning, so it's naturally deduped.
 *
 * Auth: Vercel cron sends Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
  }
  if (!pushConfigured()) {
    return NextResponse.json({ ok: true, skipped: 'VAPID not configured', sent: 0 });
  }

  const db = getDb();
  const now = Date.now();

  // One row per subscribed user + when they were last nudged (idempotency).
  const subRows = await db
    .select({
      userId: s.pushSubscriptions.userId,
      lastNudgedAt: sql<Date | null>`max(${s.pushSubscriptions.lastNudgedAt})`,
    })
    .from(s.pushSubscriptions)
    .groupBy(s.pushSubscriptions.userId);

  let sent = 0;
  let calm = 0;
  let skipped = 0;
  for (const { userId, lastNudgedAt } of subRows) {
    // Cooldown: already nudged this morning → don't send again.
    if (lastNudgedAt && now - new Date(lastNudgedAt).getTime() < NUDGE_COOLDOWN_MS) {
      skipped += 1;
      continue;
    }
    try {
      const workspaceId = await firstWorkspaceForUser(userId);
      if (!workspaceId) continue;
      const plan = await buildMorningPlan(workspaceId, userId, { withSummary: false });
      const body = composeNudge(plan);
      if (!body) {
        calm += 1;
        continue;
      }
      const reached = await sendPushToUser(userId, { title: 'Ctrl+K · Heute', body, url: '/plan' });
      sent += reached;
      // Stamp all of the user's subs so the cooldown holds even on retry.
      if (reached > 0) {
        await db
          .update(s.pushSubscriptions)
          .set({ lastNudgedAt: new Date() })
          .where(eq(s.pushSubscriptions.userId, userId))
          .catch(() => {});
      }
    } catch (e) {
      console.warn(`[cron/nudges] user=${userId} failed:`, e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ ok: true, users: subRows.length, sent, calm, skipped });
}

/**
 * One calm line from the plan's real signals, or null when nothing is urgent.
 * Deliberately only surfaces overdue/due-today commitments + waiting customers
 * — NOT future open commitments or calendar events (those aren't "act now").
 * So a day can be non-isCalm yet produce no nudge, by design.
 */
function composeNudge(plan: Awaited<ReturnType<typeof buildMorningPlan>>): string | null {
  const { stats } = plan;
  const parts: string[] = [];

  if (stats.overdueCommitments > 0) {
    parts.push(
      `${stats.overdueCommitments} überfällige ${stats.overdueCommitments === 1 ? 'Zusage' : 'Zusagen'}`
    );
  }
  if (stats.dueTodayCommitments > 0) {
    parts.push(
      `${stats.dueTodayCommitments} ${stats.dueTodayCommitments === 1 ? 'Zusage' : 'Zusagen'} heute fällig`
    );
  }
  // Prefer a concrete waiting customer ("Thomas wartet seit 5 Tagen") over a count.
  // The timing label reads naturally only when it's the "wartet seit …" form;
  // otherwise fall back to a plain "wartet".
  const waiter = plan.items.find((i) => i.kind === 'reply_waiting');
  if (waiter) {
    const t = waiter.timing && waiter.timing.startsWith('wartet') ? waiter.timing : 'wartet';
    parts.push(`${waiter.title} ${t}`);
  } else if (stats.repliesWaiting > 0) {
    parts.push(`${stats.repliesWaiting} ${stats.repliesWaiting === 1 ? 'Kunde wartet' : 'Kunden warten'} auf Antwort`);
  }

  if (parts.length === 0) return null;
  return parts.slice(0, 2).join(' · ');
}

async function firstWorkspaceForUser(userId: string): Promise<string | null> {
  const db = getDb();
  const m = await db.query.workspaceMembers.findFirst({
    where: eq(s.workspaceMembers.userId, userId),
    orderBy: [asc(s.workspaceMembers.joinedAt)],
    columns: { workspaceId: true },
  });
  return m?.workspaceId ?? null;
}
