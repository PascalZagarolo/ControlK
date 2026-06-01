import { Eyebrow, Section } from '@/components/marketing/primitives';
import { Reveal } from '@/components/marketing/reveal';

/**
 * Der rote Faden: das gemeinsame Problem aller Kategorien. Muster-Ebene,
 * kein Marken-Talk. „Productivity Theater“ als Kernbeobachtung.
 */
export function SharedProblem() {
  return (
    <Section className="py-16 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <Eyebrow>Der rote Faden</Eyebrow>
          <h2 className="mt-4 font-display text-[26px] font-semibold leading-[1.18] tracking-[-0.02em] text-ink-50 sm:text-[34px]">
            Das Problem ist nicht, dass dir Funktionen fehlen.{' '}
            <span className="text-accent">Es sind zu viele.</span>
          </h2>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="mt-7 space-y-5 font-body text-[16px] leading-relaxed text-ink-200 sm:text-[17px]">
            <p>
              Die flexibelsten Tools sind so offen, dass man endlos an Setup, Ansichten
              und Layout feilt — statt zu arbeiten. Man baut ein wunderschönes System
              und produziert damit nichts. Das ist <em className="not-italic text-ink-50">Productivity
              Theater</em>: die Arbeit am System fühlt sich produktiv an, ist es aber nicht.
            </p>
            <p>
              Mail-Clients machen die Inbox schneller — aber du verarbeitest weiterhin
              jede Mail selbst. Task-Manager werden mit Features aufgeladen, bis die
              Basics darunter leiden. Drei Wege, dasselbe Ergebnis: mehr Werkzeug, nicht
              weniger Aufwand.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.16}>
          <p className="mt-8 border-l-2 border-accent/40 pl-4 font-display text-[18px] leading-[1.5] tracking-[-0.01em] text-ink-50 sm:text-[20px]">
            Ctrl+K gibt dir keinen leeren Baukasten. Es gibt dir morgens einen fertigen
            Plan.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}
