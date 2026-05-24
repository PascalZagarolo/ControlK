import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';

const TITLE = 'Ctrl K — One workspace. Many lives.';
const DESCRIPTION =
  'Der ruhige Operations-Hub. Ein Cmd+K von überall — Inbox, Notizen, Todos, Kalender, dein Tag.';
const SITE_URL = 'https://ctrlk.de';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: 'Ctrl K',
    type: 'website',
    locale: 'de_DE',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0A0A0C',
  width: 'device-width',
  initialScale: 1,
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#0A0A0C',
        color: '#FAFAFA',
        minHeight: '100vh',
        fontFeatureSettings: '"ss01", "cv11"',
      }}
    >
      {children}
      {/* Vercel Analytics — cookieless, no consent banner required.
          Scoped to the marketing landing tree only; the app tree gets
          its own analytics decision later. */}
      <Analytics />
    </div>
  );
}
