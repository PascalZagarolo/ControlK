import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { listCustomersPage } from '@/lib/db/queries/customers';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ items: [], nextCursor: null, hasMore: false });
  const ws = await requireCurrentWorkspace();
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const validStatus =
    status === 'aktiv' || status === 'lead' || status === 'inaktiv' ? status : undefined;
  const page = await listCustomersPage(ws.id, {
    cursor: url.searchParams.get('cursor'),
    limit: Number(url.searchParams.get('limit') ?? 50),
    statusFilter: validStatus,
    q: url.searchParams.get('q') ?? undefined,
  });
  return NextResponse.json(page);
}
