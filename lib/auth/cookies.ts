import 'server-only';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'urent_session';

const isProduction = () => process.env.NODE_ENV === 'production';

export async function setSessionCookie(token: string, expiresAt: Date) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSessionToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}
