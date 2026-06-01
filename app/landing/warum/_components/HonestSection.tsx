import { Eyebrow, Section } from '@/components/marketing/primitives';
import { Reveal } from '@/components/marketing/reveal';
import { HONEST_POINTS } from '../comparison';

/**
 * Die Ehrlichkeits-Sektion — der Trust-Anker. Glaubwürdig WEIL sie eigene
 * Grenzen zugibt (Gmail-only u. a.). Pflicht, nicht weglassen.
 */
export function HonestSection() {
  return (
    <Section id="ehrlich">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <Eyebrow>Ehrlich gesagt</Eyebrow>
          <h2 className="mt-4 font-display text-[26px] font-semibold leading-[1.18] tracking-[-0.02em] text-ink-50 sm:text-[34px]">
            Wo Ctrl+K (noch) nicht das richtige Tool ist.
          </h2>
          <p className="mt-5 font-body text-[15px] leading-relaxed text-ink-300 sm:text-[16px]">
            Eine Vergleichsseite, die nur die eigenen Stärken kennt, ist Werbung. Also
            hier ohne Beschönigung: Drei Fälle, in denen du woanders besser aufgehoben
            bist.
          </p>
        </Reveal>

        <div className="mt-10 flex flex-col divide-y divide-white/[0.07] border-y border-white/[0.07]">
          {HONEST_POINTS.map((point, i) => (
            <Reveal key={point.when} delay={Math.min(i * 0.06, 0.18)}>
              <div className="grid gap-3 py-6 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] sm:gap-10">
                <p className="font-display text-[17px] font-medium leading-snug tracking-[-0.01em] text-ink-50">
                  {point.when}
                </p>
                <p className="font-body text-[15px] leading-relaxed text-ink-200">
                  {point.answer}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.12}>
          <p className="mt-9 font-body text-[16px] leading-relaxed text-ink-200 sm:text-[17px]">
            Ctrl+K ist für die, die ihren Tag <span className="text-ink-50">erledigt</span>{' '}
            haben wollen — nicht für die, die ihn gern selbst zusammenbauen.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}
