import { CTA, Section } from './primitives';
import { Reveal } from './reveal';

/**
 * Pricing-Teaser — Anchor auf den Wert, nicht auf Zahlen. Drei Tiers nur
 * angedeutet; konkrete Preise leben auf /pricing.
 */
const TIERS = [
  { name: 'Free', note: 'Zum Reinschnuppern' },
  { name: 'Solo', note: 'Für eine:n', highlight: true },
  { name: 'Team', note: 'Für kleine Crews' },
];

export function PricingTeaser() {
  return (
    <Section>
      <div className="mx-auto max-w-2xl text-center">
        <Reveal>
          <h2 className="font-display text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink-50 sm:text-[38px]">
            Eine verlorene Zusage kostet mehr als ein Jahr Ctrl+K.
          </h2>
        </Reveal>
      </div>

      <div className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-3">
        {TIERS.map((t, i) => (
          <Reveal key={t.name} delay={i * 0.08}>
            <div
              className={`rounded-2xl border p-6 text-center ${
                t.highlight
                  ? 'border-accent/30 bg-accent-soft'
                  : 'border-white/[0.07] bg-white/[0.015]'
              }`}
            >
              <p className="font-display text-[19px] font-medium text-ink-50">{t.name}</p>
              <p className="mt-1.5 text-[13px] text-ink-300">{t.note}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <div className="mt-10 flex justify-center">
          <CTA href="/pricing" variant="ghost">
            Preise ansehen
          </CTA>
        </div>
      </Reveal>
    </Section>
  );
}
