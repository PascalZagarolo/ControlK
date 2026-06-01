import { CTA, Section } from './primitives';
import { Reveal } from './reveal';

/** Finaler CTA — ruhiger Abschluss, eine klare Handlung. */
export function FinalCTA() {
  return (
    <Section className="py-24 sm:py-32">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-[30px] font-semibold leading-[1.12] tracking-[-0.02em] text-ink-50 sm:text-[42px]">
          Guck morgen früh einmal rein. Den Rest macht Ctrl+K.
        </h2>
        <div className="mt-9 flex justify-center">
          <CTA href="/sign-up" variant="primary">
            Kostenlos starten
          </CTA>
        </div>
      </Reveal>
    </Section>
  );
}
