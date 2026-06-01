import { CTA, Section } from '@/components/marketing/primitives';
import { Reveal } from '@/components/marketing/reveal';

/**
 * Abschluss-CTA. Ruhig, kein Marktschreier — die Haltung der Seite bis zuletzt.
 */
export function WarumCTA() {
  return (
    <Section className="py-24 sm:py-32">
      {/* Weicher Akzent-Schein, spiegelt den Hero. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-8 -z-10 mx-auto h-[260px] max-w-2xl opacity-70"
        style={{
          background:
            'radial-gradient(50% 50% at 50% 50%, rgba(139,127,255,0.10) 0%, rgba(139,127,255,0) 70%)',
        }}
      />

      <Reveal>
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-display text-[26px] font-semibold leading-[1.18] tracking-[-0.02em] text-ink-50 sm:text-[34px]">
            Guck morgen früh einmal rein. Den Rest macht Ctrl+K.
          </h2>
          <p className="mx-auto mt-5 max-w-md font-body text-[15px] leading-relaxed text-ink-200 sm:text-[16px]">
            Konto erstellen, ersten Morgen-Plan abwarten. Kein Setup, keine Kreditkarte,
            kein Newsletter.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <CTA href="/sign-up" variant="primary" className="w-full sm:w-auto">
              Kostenlos starten
            </CTA>
            <CTA href="/pricing" variant="ghost" className="w-full sm:w-auto">
              Preise ansehen
            </CTA>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
