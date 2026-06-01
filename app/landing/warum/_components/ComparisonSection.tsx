import type { ReactNode } from 'react';
import { Eyebrow, Section } from '@/components/marketing/primitives';
import { Reveal } from '@/components/marketing/reveal';
import { COMPARISON_BLOCKS, type ComparisonBlock } from '../comparison';

/**
 * Vergleich nach Kategorie. Drei Blöcke, jeder als Erzählbogen:
 * „Das Muster“ → „Was Nutzer erleben“ → „Wie Ctrl+K es macht“.
 * Keine Häkchen-Tabelle (wirkt kleinlich) — Muster-Ebene, fair, neutral.
 */
export function ComparisonSection() {
  return (
    <Section id="vergleich">
      <div className="mx-auto max-w-3xl text-center">
        <Reveal>
          <Eyebrow>Drei Kategorien, ein Muster</Eyebrow>
          <h2 className="mt-4 font-display text-[26px] font-semibold leading-[1.18] tracking-[-0.02em] text-ink-50 sm:text-[34px]">
            Wo gute Tools dich allein lassen — und wo Ctrl+K übernimmt.
          </h2>
          <p className="mx-auto mt-5 max-w-xl font-body text-[15px] leading-relaxed text-ink-300 sm:text-[16px]">
            Nicht „besser oder schlechter“, sondern eine andere Grundannahme. Jede
            Beobachtung unten ist eine, die echte Nutzer wirklich äußern.
          </p>
        </Reveal>
      </div>

      <div className="mt-12 flex flex-col gap-6 sm:mt-16 sm:gap-8">
        {COMPARISON_BLOCKS.map((block, i) => (
          <Reveal key={block.id} delay={Math.min(i * 0.06, 0.18)}>
            <BlockCard block={block} />
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function PartLabel({
  children,
  accent = false,
}: {
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <p
      className={`font-mono text-[10.5px] uppercase tracking-[0.16em] ${
        accent ? 'text-accent' : 'text-ink-300'
      }`}
    >
      {children}
    </p>
  );
}

function BlockCard({ block }: { block: ComparisonBlock }) {
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-ink-700/40 p-6 shadow-panel sm:p-8">
      {/* Kopf: Ordnungszahl + Kategorie + neutrale Beispiele. */}
      <header className="flex flex-col gap-1.5 border-b border-white/[0.06] pb-6 sm:flex-row sm:items-baseline sm:justify-between">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[12px] tracking-[0.04em] text-accent">
            {block.index}
          </span>
          <h3 className="font-display text-[20px] font-semibold tracking-[-0.01em] text-ink-50 sm:text-[24px]">
            {block.category}
          </h3>
        </div>
        <span className="font-mono text-[11.5px] text-ink-300">{block.examples}</span>
      </header>

      {/* Erzählbogen: Problemseite links, Ctrl+K-Antwort rechts. */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:gap-10">
        {/* Problemseite */}
        <div className="flex flex-col gap-6">
          <div>
            <PartLabel>Das Muster</PartLabel>
            <p className="mt-2.5 font-body text-[15px] leading-relaxed text-ink-200">
              {block.pattern}
            </p>
          </div>

          <div>
            <PartLabel>Was Nutzer erleben</PartLabel>
            <ul className="mt-3 flex flex-col gap-2.5">
              {block.experiences.map((line) => (
                <li
                  key={line}
                  className="flex gap-2.5 font-body text-[14.5px] leading-relaxed text-ink-200"
                >
                  <span
                    aria-hidden
                    className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-500"
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Ctrl+K-Antwort — der Wendepunkt, dezent in Akzent gefasst. */}
        <div className="flex">
          <div className="flex w-full flex-col justify-center rounded-xl border border-accent-line bg-accent-soft p-5 sm:p-6">
            <PartLabel accent>Wie Ctrl+K es macht</PartLabel>
            <p className="mt-2.5 font-body text-[15px] leading-relaxed text-ink-50 sm:text-[15.5px]">
              {block.ctrlk}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
