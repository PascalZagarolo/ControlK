import { NextResponse, type NextRequest } from 'next/server';
import { confirmWaitlist } from '@/lib/actions/waitlist';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  const result = await confirmWaitlist(token);

  const base = req.nextUrl.origin;

  if (result.ok) {
    const url = new URL('/danke', base);
    if (result.alreadyConfirmed) url.searchParams.set('again', '1');
    return NextResponse.redirect(url, { status: 303 });
  }

  const url = new URL('/', base);
  url.searchParams.set('confirm', result.reason);
  url.hash = 'waitlist';
  return NextResponse.redirect(url, { status: 303 });
}
