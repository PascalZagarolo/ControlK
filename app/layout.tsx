import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/header/header';
import { CmdK } from '@/components/cmdk/cmd-k';
import { KeyboardListener } from '@/components/cmdk/keyboard-listener';
import { QuickCreateMount } from '@/components/todos/quick-create-mount';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'uRent',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <Header />
        {children}
        <CmdK />
        <QuickCreateMount />
        <KeyboardListener />
      </body>
    </html>
  );
}
