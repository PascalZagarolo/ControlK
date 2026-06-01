import { Section } from './primitives';
import { Reveal } from './reveal';

/**
 * Problem — eine einzige, präzise Aussage. Kein Feature-Talk, nur der
 * Schmerz der Zielgruppe (client-facing Selbstständige).
 */
export function Problem() {
  return (
    <Section className="py-16 sm:py-20">
      <Reveal>
        <p className="mx-auto max-w-3xl text-center font-display text-[22px] leading-[1.5] tracking-[-0.01em] text-ink-50 sm:text-[28px]">
          Du jonglierst fünf Kunden in drei Inboxen. Irgendwo in deinen gesendeten
          Mails steht ein{' '}
          <span className="text-ink-200">„schick ich dir bis Freitag“</span> — und du
          erinnerst dich erst, wenn der Kunde nachhakt.{' '}
          <span className="text-ink-300">
            Nicht weil du schlecht organisiert bist, sondern weil keine deiner Apps
            weiß, was du wem versprochen hast.
          </span>
        </p>
      </Reveal>
    </Section>
  );
}
