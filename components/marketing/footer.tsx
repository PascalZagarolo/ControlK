import Link from 'next/link';

/**
 * Schlichter Footer. Impressum + Datenschutz sind im DACH-Raum Pflicht.
 * Beide Seiten existieren bereits unter app/landing/{impressum,datenschutz}
 * (auf ctrlk.de via Rewrite als /impressum bzw. /datenschutz erreichbar) —
 * aktuell aber nur als § 5 TMG-Template.
 * TODO(Pascal): Rechtstexte vor Launch finalisieren (eRecht24/Anwalt).
 */
const LINKS = [
  { label: 'Preise', href: '/pricing' }, // TODO(Pascal): /pricing-Seite existiert noch nicht
  { label: 'Datenschutz', href: '/datenschutz' },
  { label: 'Impressum', href: '/impressum' },
  { label: 'Kontakt', href: 'mailto:hello@ctrlk.de' },
];

export function MarketingFooter() {
  const year = 2026; // statisch, damit der Build deterministisch bleibt

  return (
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-5 px-5 py-10 sm:flex-row sm:px-8">
        <Link
          href="/"
          className="font-display text-[14px] font-semibold tracking-[-0.01em] text-ink-50"
        >
          Ctrl<span className="text-accent">+</span>K
        </Link>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="text-[13px] text-ink-300 transition-colors hover:text-ink-50"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <p className="text-[12px] text-ink-300">© {year} Ctrl+K</p>
      </div>
    </footer>
  );
}
