import type { Metadata } from 'next';
import { Inter_Tight } from 'next/font/google';
import { GeistSans } from 'geist/font/sans';

import { MarketingNav } from '@/components/marketing/nav';
import { MarketingFooter } from '@/components/marketing/footer';
import { WarumHero } from './_components/WarumHero';
import { SharedProblem } from './_components/SharedProblem';
import { ComparisonSection } from './_components/ComparisonSection';
import { HonestSection } from './_components/HonestSection';
import { OneLiner } from './_components/OneLiner';
import { WarumCTA } from './_components/WarumCTA';

// Headline-Font (Inter Tight) als CSS-Variable. Geist (Body) bringt seine
// eigene Variable mit. Beide werden NUR auf dem Wrapper unten gesetzt, damit
// die App-Shell unberührt bleibt — gleiches Muster wie app/landing/page.tsx.
const interTight = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-inter-tight',
  display: 'swap',
});

const TITLE = 'Warum Ctrl+K — ehrlich verglichen';
const DESCRIPTION =
  'Woran Produktivitäts- und Mail-Tools für selbstständige Kundenarbeit scheitern — und wie Ctrl+K es anders macht. Fair, auf Muster-Ebene, inklusive der eigenen Grenzen.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/warum' },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/warum',
    siteName: 'Ctrl K',
    type: 'article',
    locale: 'de_DE',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
};

/**
 * „Warum Ctrl+K“ (ctrlk.de/warum) — ehrliche Vergleichsseite. Gleicher Stack,
 * gleiches Design wie die Landingpage: dieselbe Nav/Footer, dieselbe
 * Schrift-/Token-Sprache. Sektionen sauber getrennt; die drei Vergleichsblöcke
 * + Ehrlichkeits-Punkte liegen in ./comparison.ts.
 *
 * Server-Component — nur die Reveals sind 'use client'. Middleware mappt die
 * Bare-Route /warum auf /landing/warum (siehe LANDING_BARE_PATHS).
 */
export default function WarumPage() {
  return (
    <div
      className={`${interTight.variable} ${GeistSans.variable} min-h-screen bg-ink-900 font-body text-ink-50 antialiased`}
    >
      <MarketingNav />
      <main>
        <WarumHero />
        <SharedProblem />
        <ComparisonSection />
        <HonestSection />
        <OneLiner />
        <WarumCTA />
      </main>
      <MarketingFooter />
    </div>
  );
}
