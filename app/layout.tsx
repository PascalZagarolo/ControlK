import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/header/header';
import { ProfileDock } from '@/components/header/profile-dock';
import { CmdK } from '@/components/cmdk/cmd-k';
import { KeyboardListener } from '@/components/cmdk/keyboard-listener';
import { QuickCreateMount } from '@/components/todos/quick-create-mount';
import { PusherProvider } from '@/components/realtime/pusher-provider';
import { RegisterSW } from '@/components/pwa/register-sw';
import { MobileFab } from '@/components/pwa/mobile-fab';
import { HelpButton } from '@/components/support/help-button';
import { getPusherClientConfig } from '@/lib/realtime/pusher-server';
import { currentUser } from '@/lib/auth/current-user';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'uRent — Workspace OS',
  description: 'Privat + Business in einem Tool. Reality-anchored work.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'uRent',
  },
};

export const viewport: Viewport = {
  themeColor: '#0c0d0f',
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
        <body>{children}</body>
      </html>
    );
  }

  const pusherConfig = getPusherClientConfig();
  const user = await currentUser();
  return (
    <html lang="de" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <PusherProvider config={pusherConfig} userId={user?.id}>
          <Header />
          <ProfileDock />
          {children}
          <CmdK />
          <QuickCreateMount />
          <KeyboardListener />
          <RegisterSW />
          <MobileFab />
          <HelpButton />
        </PusherProvider>
      </body>
    </html>
  );
}
