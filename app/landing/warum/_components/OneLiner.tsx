import { Section } from '@/components/marketing/primitives';
import { Reveal } from '@/components/marketing/reveal';

/**
 * Der Unterschied in einem Satz. Große, ruhige Aussage — die Quintessenz der
 * Seite, mit viel Negativraum.
 */
export function OneLiner() {
  return (
    <Section className="py-20 sm:py-28">
      <Reveal>
        <p className="mx-auto max-w-3xl text-center font-display text-[24px] font-medium leading-[1.4] tracking-[-0.02em] text-ink-50 sm:text-[32px]">
          Andere Tools geben dir einen Ort, um deinen Tag zu organisieren.{' '}
          <span className="text-ink-300">
            Ctrl+K gibt dir den Tag schon geplant — um die Zusagen herum, die du sonst
            vergisst.
          </span>
        </p>
      </Reveal>
    </Section>
  );
}
