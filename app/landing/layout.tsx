import type { Metadata, Viewport } from 'next';

const TITLE = 'Ctrl K — One workspace. Many lives.';
const DESCRIPTION =
  'Der ruhige Operations-Hub. Inbox, Notizen, Todos, Kalender, Kontakte — ein Cmd+K von überall. Gmail-Integration, AI-Briefing, Stack-by-Customer, Wartet-auf-Antwort-Split. Gebaut in Deutschland.';
const SITE_URL = 'https://ctrlk.de';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: 'Ctrl K',
  keywords: [
    'Operations Hub',
    'Inbox Zero',
    'Notizen',
    'Todos',
    'Kalender',
    'Gmail Integration',
    'Cmd+K',
    'Productivity Tool',
    'Solo Founder',
    'CRM Email',
    'Smart Briefing',
    'Workspace',
    'Ctrl K',
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
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
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
    </div>
  );
}
