import { NextResponse } from 'next/server';
import { hashToken } from '@/lib/auth/tokens';
import { invalidateSession } from '@/lib/auth/sessions';
import { clearSessionCookie, getSessionToken } from '@/lib/auth/cookies';

export async function POST(request: Request) {
  const token = await getSessionToken();
  if (token) await invalidateSession(hashToken(token));
  await clearSessionCookie();
  const url = new URL('/sign-in', request.url);
  return NextResponse.redirect(url, { status: 303 });
}

export const GET = POST;
