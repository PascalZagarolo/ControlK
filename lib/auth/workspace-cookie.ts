import 'server-only';
import { cookies } from 'next/headers';

export const ACTIVE_WS_COOKIE = 'urent_ws';

export async function getActiveWorkspaceCookie() {
  const jar = await cookies();
  return jar.get(ACTIVE_WS_COOKIE)?.value ?? null;
}

export async function setActiveWorkspaceCookie(slug: string) {
  const jar = await cookies();
  jar.set(ACTIVE_WS_COOKIE, slug, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearActiveWorkspaceCookie() {
  const jar = await cookies();
  jar.delete(ACTIVE_WS_COOKIE);
}
