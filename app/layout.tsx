import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/header/header';
import { CmdK } from '@/components/cmdk/cmd-k';
import { KeyboardListener } from '@/components/cmdk/keyboard-listener';
import { QuickCreateMount } from '@/components/todos/quick-create-mount';
import { PusherProvider } from '@/components/realtime/pusher-provider';
import { getPusherClientConfig } from '@/lib/realtime/pusher-server';
import { currentUser } from '@/lib/auth/current-user';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'uRent',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const pusherConfig = getPusherClientConfig();
  const user = await currentUser();
  return (
    <html lang="de" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <PusherProvider config={pusherConfig} userId={user?.id}>
          <Header />
          {children}
          <CmdK />
          <QuickCreateMount />
          <KeyboardListener />
        </PusherProvider>
      </body>
    </html>
  );
}
