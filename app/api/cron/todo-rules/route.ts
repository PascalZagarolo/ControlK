import { NextResponse, type NextRequest } from 'next/server';
import { getDb, hasDb } from '@/lib/db/client';
import { runWorkspaceRules } from '@/lib/actions/automations';
import * as s from '@/lib/db/schema';

/**
 * Vercel Cron entrypoint — runs Todo auto-rules across all workspaces.
 *
 * Recommended schedule (vercel.json): every hour, e.g. "0 * * * *"
 * Optional protection: set CRON_SECRET in env, and Vercel will send it
 * as Authorization: Bearer <secret>.
 */
export async function GET(req: NextRequest) {
  if (!hasDb()) return NextResponse.json({ ok: false, error: 'No DB' }, { status: 500 });

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authz = req.headers.get('authorization');
    if (authz !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 401 });
    }
  }

  const db = getDb();
  const workspaces = await db.query.workspaces.findMany({ columns: { id: true, slug: true } });
  const results: Array<{ workspace: string; created: number }> = [];
  let total = 0;
  for (const ws of workspaces) {
    try {
      const n = await runWorkspaceRules(ws.id);
      total += n;
      if (n > 0) results.push({ workspace: ws.slug, created: n });
    } catch (e) {
      console.error('[cron/todo-rules] workspace failed', ws.slug, e);
    }
  }
  return NextResponse.json({ ok: true, total, results });
}

export const POST = GET;
