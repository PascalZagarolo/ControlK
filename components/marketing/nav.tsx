import Link from 'next/link';
import { CTA } from './primitives';

/**
 * Schlanke, sticky Top-Nav (Logo + ein CTA). Premium-Standard à la
 * Linear/Stripe — kein Mega-Menü, kein Lärm.
 */
export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-ink-900/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="font-display text-[15px] font-semibold tracking-[-0.01em] text-ink-50"
        >
          Ctrl<span className="text-accent">+</span>K
        </Link>
        <CTA href="/sign-up" variant="primary" className="h-9 px-4 text-[14px]">
          Kostenlos starten
        </CTA>
      </div>
    </header>
  );
}
