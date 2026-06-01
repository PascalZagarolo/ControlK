import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Geteilte Bausteine der Landingpage. Halten die Sektionen schlank und die
 * Abstände/Token konsistent — Negativraum, ruhige Hierarchie (Linear/Stripe).
 */

/** Vertikaler Sektions-Rhythmus + zentrierter Content-Container. */
export function Section({
  id,
  children,
  className = '',
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`relative mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28 ${className}`}
    >
      {children}
    </section>
  );
}

/** Kleines Label über einer Überschrift. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-accent">
      {children}
    </p>
  );
}

/** Primärer (gefüllter) oder sekundärer (Ghost) Call-to-Action. */
export function CTA({
  href,
  children,
  variant = 'primary',
  className = '',
}: {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'ghost';
  className?: string;
}) {
  const base =
    'inline-flex h-11 items-center justify-center rounded-xl px-5 text-[15px] font-medium transition-all duration-200 ease-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';
  const styles =
    variant === 'primary'
      ? 'bg-accent text-ink-900 hover:bg-[#9D93FF] shadow-[0_8px_30px_-8px_rgba(139,127,255,0.6)]'
      : 'border border-white/12 bg-white/[0.02] text-ink-50 hover:border-white/24 hover:bg-white/[0.04]';
  return (
    <Link href={href} className={`${base} ${styles} ${className}`}>
      {children}
    </Link>
  );
}

/**
 * Dunkler App-/Browser-Rahmen für Produkt-Visuals. `children` ist der Inhalt
 * der Fläche (echte Feature-Mockups in den Wedge-Sektionen, oder ein
 * Platzhalter im Hero). Reiner Rahmen — verspricht nichts von sich aus.
 */
export function WindowFrame({
  children,
  label,
  className = '',
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-700/60 shadow-panel backdrop-blur-sm ${className}`}
    >
      {/* Fensterleiste */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" aria-hidden />
        {label && (
          <span className="ml-2 font-mono text-[11px] tracking-[0.04em] text-ink-300">
            {label}
          </span>
        )}
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}
