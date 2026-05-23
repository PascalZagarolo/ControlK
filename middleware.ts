import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PREFIXES = [
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/magic-link',
  '/api/auth/',
  '/raycast-content',
];

const COOKIE = 'urent_session';

export default function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublic = PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + '/') || path === p);
  if (isPublic) return NextResponse.next();

  const token = req.cookies.get(COOKIE)?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/sign-in';
    url.searchParams.set('from', path);
    return NextResponse.redirect(url);
  }
  // Full validation (DB query) happens in server components via currentUser().
  // Middleware only checks cookie presence to keep the edge path fast.
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|raycast.html|Raycast.*).*)',
  ],
};
