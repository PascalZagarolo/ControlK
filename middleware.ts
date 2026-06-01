import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PREFIXES = [
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/magic-link',
  '/api/auth/',
  '/api/waitlist/',
  '/raycast-content',
  '/dev/',
];

// Bare paths that always render landing content, regardless of host —
// reachable in dev as localhost:3000/impressum and in prod as
// ctrlk.de/impressum. The page source lives at /landing/impressum.
const LANDING_BARE_PATHS = new Set([
  '/impressum',
  '/datenschutz',
  '/danke',
  '/warum',
  '/pricing',
]);

const COOKIE = 'urent_session';

// Marketing hostnames — when the incoming Host header matches one of these,
// the root path serves the marketing landing for anonymous visitors.
// Authenticated visitors fall through to the Foyer like on any other host.
// Local dev can preview the landing via ?landing=1 instead.
const LANDING_HOSTS = (process.env.LANDING_HOSTS ?? 'ctrlk.de,www.ctrlk.de')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function landingRewrite(req: NextRequest, landingPath: string): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = landingPath;
  const headers = new Headers(req.headers);
  headers.set('x-route-class', 'landing');
  headers.set('x-pathname', req.nextUrl.pathname);
  return NextResponse.rewrite(url, { request: { headers } });
}

function passthrough(req: NextRequest, asLanding = false): NextResponse {
  const headers = new Headers(req.headers);
  headers.set('x-pathname', req.nextUrl.pathname);
  if (asLanding) headers.set('x-route-class', 'landing');
  return NextResponse.next({ request: { headers } });
}

export default function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const host = (req.headers.get('host') ?? '').toLowerCase().split(':')[0];
  const isMarketingHost =
    LANDING_HOSTS.includes(host) ||
    req.nextUrl.searchParams.get('landing') === '1';

  // Bare marketing paths render landing content on any host.
  if (LANDING_BARE_PATHS.has(path)) {
    return landingRewrite(req, '/landing' + path);
  }

  // The /landing tree itself — pass through with the landing class stamp
  // so the root layout drops app chrome.
  if (path === '/landing' || path.startsWith('/landing/')) {
    return passthrough(req, true);
  }

  // Marketing host: root path is conditional on auth.
  //   - Anonymous visitor on ctrlk.de  → marketing landing
  //   - Authenticated visitor on ctrlk.de → Foyer (fall through)
  // Without this branch, signed-in users would land on the marketing page
  // every time they navigate home.
  if (isMarketingHost && path === '/') {
    const token = req.cookies.get(COOKIE)?.value;
    if (!token) return landingRewrite(req, '/landing');
    // Authenticated — fall through; the Foyer renders at app/page.tsx.
  }

  // Public auth + utility prefixes — no cookie required.
  const isPublic = PUBLIC_PREFIXES.some(
    (p) => path === p || path.startsWith(p + '/')
  );
  if (isPublic) return passthrough(req);

  // API routes — own auth handling per route.
  if (path.startsWith('/api/')) return passthrough(req);

  // Everything else requires a session.
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/sign-in';
    url.searchParams.set('from', path);
    return NextResponse.redirect(url);
  }
  return passthrough(req);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|raycast.html|Raycast.*).*)',
  ],
};
