import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { currentUser } from '@/lib/auth/current-user';
import { incrementalSyncCalendar } from '@/lib/google/calendar';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Manual sync. Useful as a "refresh" button on the calendar page and
 * as a fallback when webhooks miss something (network blip, watch
 * silently dropped, dev environment without public HTTPS).
 *
 * Debouncing is the caller's job — recommended max once per 5 min on
 * page load. We don't enforce server-side because the manual button
 * is also valid behavior.
 */
export async function POST() {
  const user = await currentUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const db = getDb();
  const ws = await db.query.workspaceMembers.findFirst({
    where: eq(s.workspaceMembers.userId, user.id),
    columns: { workspaceId: true },
  });

  try {
    const result = await incrementalSyncCalendar(
      user.id,
      'primary',
      ws?.workspaceId ?? null
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
