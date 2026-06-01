import type { Metadata } from 'next';
import { Inter_Tight } from 'next/font/google';
import { GeistSans } from 'geist/font/sans';

import { MarketingNav } from '@/components/marketing/nav';
import { Hero } from '@/components/marketing/hero';
import { Problem } from '@/components/marketing/problem';
import { WedgeCommitments } from '@/components/marketing/wedge-commitments';
import { WedgeInbox } from '@/components/marketing/wedge-inbox';
import { WedgeMorningPlan } from '@/components/marketing/wedge-morning-plan';
import { WedgeFlowDemo } from '@/components/marketing/wedge-flow-demo';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { Trust } from '@/components/marketing/trust';
import { PricingTeaser } from '@/components/marketing/pricing-teaser';
import { FinalCTA } from '@/components/marketing/final-cta';
import { FAQ } from '@/components/marketing/faq';
import { MarketingFooter } from '@/components/marketing/footer';

// Headline-Font (Inter Tight) als CSS-Variable. Geist (Body) bringt seine
// eigene Variable mit. Beide werden NUR auf dem Wrapper unten gesetzt, damit
// die App-Shell unberührt bleibt.
const interTight = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-inter-tight',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { absolute: 'Ctrl+K — Plane deinen Tag um deine Zusagen herum' },
  description:
    'Ctrl+K plant den Arbeitstag von Freelancern, Agenturen und Beratern um die offenen Zusagen herum, die sonst durchrutschen. Mails, Kalender und Versprechen in einem Plan.',
  // Auf ctrlk.de wird /landing am Apex (/) ausgeliefert (siehe middleware.ts).
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Ctrl+K — Plane deinen Tag um deine Zusagen herum',
    description:
      'Der eine Plan, den keine deiner Apps allein bauen kann. Für client-facing Selbstständige.',
    url: '/',
    type: 'website',
  },
};

/**
 * Marketing-Landingpage (Repositionierung um den Zusagen-Wedge).
 * Single-Page, deutsch, conversion-fokussiert. Server-Component — nur die
 * interaktiven Teile (Reveals, FAQ-Accordion) sind 'use client'.
 *
 * Reihenfolge der Beweis-Sektionen ist gesperrt: Wedge (Zusagen + Inbox)
 * VOR Morgen-Plan VOR der "eine Oberfläche"-Story. Grund zu zahlen vor
 * Verpackung.
 */
export default function LandingPage() {
  return (
    <div
      className={`${interTight.variable} ${GeistSans.variable} min-h-screen bg-ink-900 font-body text-ink-50 antialiased`}
    >
      <MarketingNav />
      <main>
        <Hero />
        <Problem />
        <WedgeCommitments />
        <WedgeInbox />
        <WedgeMorningPlan />
        <WedgeFlowDemo />
        <HowItWorks />
        <Trust />
        <PricingTeaser />
        <FinalCTA />
        <FAQ />
      </main>
      <MarketingFooter />
    </div>
  );
}
