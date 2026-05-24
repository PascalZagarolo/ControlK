import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth/current-user';
import { getCurrentWorkspace } from '@/lib/db/current-workspace';
import { syncGmailForUser } from '@/lib/google/gmail-sync';

export const dynamic = 'force-dynamic';

// Manual sync trigger. Called by the foyer client on mount (debounced
// to once-every-2-min in the caller). Falls through gracefully when
// the user isn't connected — the response shape lets the client distinguish
// "didn't run, here's why" from "ran, here are the counts".
export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, reason: 'unauthenticated' }, { status: 401 });

  const ws = await getCurrentWorkspace();
  if (!ws) return NextResponse.json({ ok: false, reason: 'no_workspace' }, { status: 400 });

  const result = await syncGmailForUser(user.id, ws.id);
  return NextResponse.json(result);
}
