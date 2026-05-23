import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { isNull } from 'drizzle-orm';
import { recomputeAllCachesForWorkspace } from '@/lib/db/cache-recompute';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Nightly drift-fix for denormalized entity caches.
 * Schedule in vercel.json — once an hour is overkill but cheap; the daily
 * variant in the cron list is sufficient for normal workloads.
 *
 * Iterates all non-archived workspaces sequentially. If a workspace's cache
 * recompute fails, log and continue — we don't want one bad workspace to
 * block every other tenant's drift-fix.
 */
export async function GET() {
  const db = getDb();
  const workspaces = await db.query.workspaces.findMany({
    where: isNull(s.workspaces.archivedAt),
    columns: { id: true, slug: true },
  });

  const results: { slug: string; ok: boolean; ms: number; error?: string }[] = [];
  for (const ws of workspaces) {
    const t0 = Date.now();
    try {
      await recomputeAllCachesForWorkspace(ws.id);
      results.push({ slug: ws.slug, ok: true, ms: Date.now() - t0 });
    } catch (e: any) {
      results.push({
        slug: ws.slug,
        ok: false,
        ms: Date.now() - t0,
        error: String(e?.message ?? e),
      });
    }
  }
  return NextResponse.json({ count: results.length, results });
}
