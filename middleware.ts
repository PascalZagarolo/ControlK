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

// Marketing hostnames — when the incoming Host header matches one of these,
// every request gets rewritten under /landing and auth is skipped. Production
// will set this to "ctrlk.de,www.ctrlk.de" via Vercel env. Local dev can
// preview the landing page via ?landing=1 instead.
const LANDING_HOSTS = (process.env.LANDING_HOSTS ?? 'ctrlk.de,www.ctrlk.de')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export default function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const host = (req.headers.get('host') ?? '').toLowerCase().split(':')[0];
  const wantsLanding =
    LANDING_HOSTS.includes(host) || req.nextUrl.searchParams.get('landing') === '1';

  // Marketing host: rewrite everything to /landing/* and stamp a request
  // header so the root layout can drop the app chrome. Setting it via
  // request.headers (not response.headers) is what makes it readable from
  // headers() in server components downstream.
  if (wantsLanding) {
    const url = req.nextUrl.clone();
    if (!url.pathname.startsWith('/landing')) {
      url.pathname = '/landing' + (url.pathname === '/' ? '' : url.pathname);
    }
    const reqHeaders = new Headers(req.headers);
    reqHeaders.set('x-route-class', 'landing');
    return NextResponse.rewrite(url, { request: { headers: reqHeaders } });
  }

  const isPublic = PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + '/') || path === p);
  const isLandingPath = path === '/landing' || path.startsWith('/landing/');
  if (isPublic || isLandingPath) {
    if (isLandingPath) {
      const reqHeaders = new Headers(req.headers);
      reqHeaders.set('x-route-class', 'landing');
      return NextResponse.next({ request: { headers: reqHeaders } });
    }
    return NextResponse.next();
  }

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
