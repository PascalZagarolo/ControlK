import type { Metadata, Viewport } from 'next';
import { Inter_Tight } from 'next/font/google';
import { GeistSans } from 'geist/font/sans';

import { MarketingNav } from '@/components/marketing/nav';
import { MarketingFooter } from '@/components/marketing/footer';
import { CTA, Eyebrow, Section } from '@/components/marketing/primitives';
import { Reveal } from '@/components/marketing/reveal';
import { tiers } from '@/lib/pricing';
import { PricingSection } from './_components/PricingSection';
import { ComparisonTable } from './_components/ComparisonTable';
import { FAQ } from './_components/FAQ';

// Headline-Font (Inter Tight) + Body (Geist) wie auf der Landingpage. Die
// Variablen werden zusätzlich am Wrapper gesetzt, damit font-display/font-body
// hier unabhängig vom Root-Layout auflösen.
const interTight = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-inter-tight',
  display: 'swap',
});

const TITLE = 'Preise — Ctrl+K';
const DESCRIPTION =
  'Flache, planbare Preise für Ctrl+K. Free zum Ausprobieren, Solo für Selbstständige mit mehreren Kunden, Team für kleine Agenturen. Monatlich kündbar, 2 Monate gratis im Jahresabo. Keine Nutzungsabrechnung.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  // Auf ctrlk.de via Rewrite als /pricing erreichbar (siehe middleware.ts).
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/pricing',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#07080a',
  width: 'device-width',
  initialScale: 1,
};

export default function PricingPage() {
  // Preise aus derselben Config wie die Cards, damit die strukturierten
  // Daten nie von der Anzeige abweichen.
  const monthly = tiers.map((t) => t.price.monthly);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Ctrl+K',
    description: DESCRIPTION,
    brand: { '@type': 'Brand', name: 'Ctrl+K' },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'EUR',
      lowPrice: String(Math.min(...monthly)),
      highPrice: String(Math.max(...monthly)),
      offerCount: tiers.length,
      offers: tiers.map((t) => ({
        '@type': 'Offer',
        name: t.name,
        price: String(t.price.monthly),
        priceCurrency: 'EUR',
        url: 'https://ctrlk.de/pricing',
      })),
    },
  };

  return (
    <div
      className={`${interTight.variable} ${GeistSans.variable} min-h-screen bg-ink-900 font-body text-ink-50 antialiased`}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <MarketingNav />

      <main>
        {/* ── Anchor-Hero — Wert framen, bevor Zahlen kommen ───────────── */}
        <section className="relative mx-auto w-full max-w-6xl px-5 pb-2 pt-24 sm:px-8 sm:pt-32">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[420px] max-w-3xl opacity-60"
            style={{
              background:
                'radial-gradient(60% 60% at 50% 0%, rgba(139,127,255,0.14) 0%, rgba(139,127,255,0) 70%)',
            }}
          />
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow>Preise</Eyebrow>
            <h1 className="mt-5 font-display text-[32px] font-semibold leading-[1.08] tracking-[-0.02em] text-ink-50 sm:text-[48px]">
              Eine verlorene Zusage kostet mehr als ein Jahr Ctrl+K.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-relaxed text-ink-200 sm:text-[18px]">
              Preise, die sich nach einem gehaltenen Versprechen rechnen — nicht
              nach Features, die du nie nutzt.
            </p>
          </div>
        </section>

        {/* ── Tiers ─────────────────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-6xl px-5 pt-14 sm:px-8 sm:pt-16">
          <PricingSection />
          <Reveal>
            <p className="mx-auto mt-10 max-w-2xl text-center text-[13px] leading-relaxed text-ink-300">
              Flache, planbare Preise — keine Nutzungsabrechnung, keine
              AI-Credits, keine Überraschung am Monatsende.
            </p>
          </Reveal>
        </section>

        {/* ── Vergleich (optional, einklappbar) ─────────────────────────── */}
        <Section className="py-16 sm:py-20">
          <Reveal>
            <ComparisonTable />
          </Reveal>
        </Section>

        {/* ── Mini-FAQ ──────────────────────────────────────────────────── */}
        <Section className="py-16 sm:py-24">
          <div className="mx-auto max-w-2xl">
            <Reveal>
              <h2 className="text-center font-display text-[26px] font-semibold tracking-[-0.02em] text-ink-50 sm:text-[34px]">
                Häufige Fragen
              </h2>
            </Reveal>
            <Reveal delay={0.05}>
              <div className="mt-10">
                <FAQ />
              </div>
            </Reveal>
          </div>
        </Section>

        {/* ── Abschluss-CTA ─────────────────────────────────────────────── */}
        <Section className="py-24 sm:py-32">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-[28px] font-semibold leading-[1.14] tracking-[-0.02em] text-ink-50 sm:text-[40px]">
              Probier den Free-Tier. Upgrade, wenn Ctrl+K dir den ersten Morgen
              gespart hat.
            </h2>
            <div className="mt-9 flex flex-col items-center gap-3">
              <CTA href="/sign-up" variant="primary">
                Kostenlos starten
              </CTA>
              <span className="text-[13px] text-ink-300">Keine Kreditkarte nötig.</span>
            </div>
          </Reveal>
        </Section>
      </main>

      <MarketingFooter />
    </div>
  );
}
