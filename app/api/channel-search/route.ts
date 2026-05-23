import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { searchMessages } from '@/lib/db/queries/channels';

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });
  const ws = await requireCurrentWorkspace();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';
  if (!q.trim()) return NextResponse.json([]);
  const hits = await searchMessages(ws.id, q, 30);
  return NextResponse.json(hits);
}
