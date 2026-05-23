import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { listTodosPage } from '@/lib/db/queries/todos';
import type { TodoStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Cursor-paginated todo list for infinite scroll + virtualized views.
 * Query params:
 *   cursor? — opaque, returned by previous response
 *   limit?  — clamped 1-200, default 50
 *   status? — comma-separated TodoStatus list
 *   assignee? — 'me' | 'unassigned' | userId
 *   customer? — customer UUID
 *   contract? — contract UUID
 *   vehicle? — vehicle UUID
 *   channel? — channel UUID
 *   group? — group UUID or 'none'
 */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ items: [], nextCursor: null, hasMore: false });
  const ws = await requireCurrentWorkspace();

  const url = new URL(req.url);
  const q = url.searchParams;
  const cursor = q.get('cursor');
  const limit = Number(q.get('limit') ?? 50);
  const status = q.get('status');
  const assignee = q.get('assignee');
  const filter = {
    status: status ? (status.split(',') as TodoStatus[]) : undefined,
    assigneeId: (assignee ?? undefined) as any,
    customerId: q.get('customer') ?? undefined,
    contractId: q.get('contract') ?? undefined,
    vehicleId: q.get('vehicle') ?? undefined,
    channelId: q.get('channel') ?? undefined,
    groupId: q.get('group') as any,
  };

  const page = await listTodosPage(ws.id, user.id, { filter, cursor, limit });
  return NextResponse.json(page);
}
