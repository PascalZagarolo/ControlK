import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Analytics } from '@vercel/analytics/next';
import { Header } from '@/components/header/header';
import { ProfileDock } from '@/components/header/profile-dock';
import { ToastHost } from '@/components/toast-host';
import { VerifyBanner } from '@/components/auth/verify-banner';
import { CalendarConnectBanner } from '@/components/auth/calendar-connect-banner';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { hasCalendarScope } from '@/lib/google/calendar';
import { CmdK } from '@/components/cmdk/cmd-k';
import { KeyboardListener } from '@/components/cmdk/keyboard-listener';
import { QuickCreateMount } from '@/components/todos/quick-create-mount';
import { PusherProvider } from '@/components/realtime/pusher-provider';
import { RegisterSW } from '@/components/pwa/register-sw';
import { MobileFab } from '@/components/pwa/mobile-fab';
import { HelpButton } from '@/components/support/help-button';
import { AskCtrlK } from '@/components/ai/ask-ctrl-k';
import { getPusherClientConfig } from '@/lib/realtime/pusher-server';
import { currentUser } from '@/lib/auth/current-user';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

const SITE_URL = 'https://ctrlk.de';
const SITE_NAME = 'Ctrl K';
const DEFAULT_TITLE = 'Ctrl K — One workspace. Many lives.';
const DEFAULT_DESCRIPTION =
  'Der ruhige Operations-Hub für Solo-Founder und Teams. Inbox, Notizen, Todos, Kalender, Kontakte — ein Cmd+K von überall.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Title-Template — child pages can override `title` with just a
  // short string and it becomes "X — Ctrl K". Pages that want the
  // full title verbatim use { title: { absolute: '…' } }.
  title: {
    default: DEFAULT_TITLE,
    template: '%s — Ctrl K',
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'Operations Hub',
    'Inbox Zero',
    'Notizen',
    'Todos',
    'Kalender',
    'Workspace',
    'Productivity',
    'Cmd+K',
    'Gmail Integration',
    'Solo Founder Tool',
  ],
  authors: [{ name: 'Pascal Zagarolo', url: SITE_URL }],
  creator: 'Pascal Zagarolo',
  publisher: 'Pascal Zagarolo',
  category: 'productivity',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: { canonical: '/' },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: SITE_NAME,
  },
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  // App-side routes are auth-walled (see robots.ts), so crawlers index
  // whatever the landing tree exposes. Per-route robots overrides on
  // share-link surfaces handle their own visibility.
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  // Aligned with the landing canvas (#0A0A0C) for a consistent
  // status-bar tint across marketing + app on mobile.
  themeColor: '#0A0A0C',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Middleware stamps x-route-class=landing on requests bound for the
  // marketing site (ctrlk.de) so we can skip the entire app chrome —
  // header, cmdk, realtime, pusher, current-user query. The landing
  // segment has its own minimal layout for OG metadata.
  const h = await headers();
  const isLanding = h.get('x-route-class') === 'landing';

  if (isLanding) {
    return (
      <html lang="de" className={`${inter.variable} ${jetbrainsMono.variable}`}>
        <body>
          {children}
          {/* Cookieless — no consent banner required. Mounted in the root
              layout so both the marketing surface and the authenticated
              app feed the same project's Web Analytics. */}
          <Analytics />
          {/* Toast host renders on both trees so even unauthenticated
              flows (sign-up confirmation, etc.) can surface feedback. */}
          <ToastHost />
        </body>
      </html>
    );
  }

  const pusherConfig = getPusherClientConfig();
  const user = await currentUser();
  // Verify banner: only when a real user is signed in AND their email
  // is unverified. Hidden on auth flows (they manage their own UI)
  // and on the verify-email page itself (would be circular).
  const pathname = h.get('x-pathname') ?? '';
  const showVerifyBanner =
    !!user &&
    !user.emailVerified &&
    !pathname.startsWith('/verify-email') &&
    !pathname.startsWith('/sign-') &&
    !pathname.startsWith('/forgot-password') &&
    !pathname.startsWith('/reset-password') &&
    !pathname.startsWith('/magic-link');

  // Calendar-connect banner: user has Google connected (refresh token
  // present) but never granted calendar scopes. Skipped on auth/invite
  // surfaces so it doesn't fight with focus-state UI.
  let showCalendarBanner = false;
  if (user && !pathname.startsWith('/sign-') && !pathname.startsWith('/invite/')) {
    try {
      const db = getDb();
      const oauth = await db.query.oauthAccounts.findFirst({
        where: and(
          eq(schema.oauthAccounts.userId, user.id),
          eq(schema.oauthAccounts.provider, 'google')
        ),
        columns: { refreshTokenEnc: true, scopes: true },
      });
      showCalendarBanner =
        !!oauth?.refreshTokenEnc && !hasCalendarScope(oauth.scopes);
    } catch {
      // DB hiccup → skip banner, not load-bearing
    }
  }
  return (
    <html lang="de" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      {/* suppressHydrationWarning swallows the harmless attribute drift
       *  some browser extensions inject on <body> (e.g. ColorZilla's
       *  `cz-shortcut-listen`, ChatGPT-Lookup's data-*). React would
       *  otherwise abort hydration and re-render the whole tree. */}
      <body suppressHydrationWarning>
        <PusherProvider config={pusherConfig} userId={user?.id}>
          <Header />
          <ProfileDock />
          {/* Floating hint banners — pinned just below the centered header
              pill (which sits at top-6, ~68px tall) so they never overlap it.
              The container ignores pointer events; each pill re-enables them
              so the gaps between/around pills stay click-through. */}
          {(showVerifyBanner || showCalendarBanner) && (
            <div className="pointer-events-none fixed inset-x-0 top-[76px] z-40 flex flex-col items-center gap-2 px-4">
              {showVerifyBanner && user && <VerifyBanner email={user.email} />}
              {showCalendarBanner && <CalendarConnectBanner />}
            </div>
          )}
          {children}
          <CmdK />
          <QuickCreateMount />
          <KeyboardListener />
          <RegisterSW />
          <MobileFab />
          <HelpButton />
          <AskCtrlK />
        </PusherProvider>
        <Analytics />
        <ToastHost />
      </body>
    </html>
  );
}
