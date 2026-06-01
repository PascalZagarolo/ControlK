import { Eyebrow, Section } from './primitives';
import { Reveal } from './reveal';

/**
 * „Eine Oberfläche statt zwölf Tabs“ — die Verpackung NACH dem Wedge.
 * Verspricht ausdrücklich nur read-only: Daten bleiben in den Quell-Tools.
 * Ziel des sekundären Hero-CTAs (#wie-es-funktioniert).
 */
const STEPS = [
  {
    n: '01',
    title: 'Verbinden',
    text: 'Gmail und Kalender verbinden. Read-only — Ctrl+K liest, schreibt nichts zurück.',
  },
  {
    n: '02',
    title: 'Ctrl+K rechnet',
    text: 'Zusagen, wartende Kunden, Termine und Tasks werden über alle Quellen zusammengeführt.',
  },
  {
    n: '03',
    title: 'Dein Plan',
    text: 'Ein Screen, der dir sagt, was heute zählt — und was kollidiert.',
  },
];

export function HowItWorks() {
  return (
    <Section id="wie-es-funktioniert">
      <div className="mx-auto max-w-2xl text-center">
        <Reveal>
          <Eyebrow>So funktioniert&apos;s</Eyebrow>
          <h2 className="mt-4 font-display text-[30px] font-semibold leading-[1.12] tracking-[-0.02em] text-ink-50 sm:text-[40px]">
            Eine Oberfläche statt zwölf Tabs.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-ink-200 sm:text-[17px]">
            Verbinde Gmail und deinen Kalender — Ctrl+K zieht alles zusammen und rechnet
            darüber. Deine Daten bleiben, wo sie sind; Ctrl+K ist die Schicht, die daraus
            deinen Plan macht.
          </p>
        </Reveal>
      </div>

      <div className="mt-14 grid gap-4 sm:grid-cols-3 sm:gap-5">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.08}>
            <div className="h-full rounded-2xl border border-white/[0.07] bg-white/[0.015] p-6">
              <span className="font-mono text-[12px] tracking-[0.1em] text-accent">{s.n}</span>
              <h3 className="mt-3 font-display text-[18px] font-medium text-ink-50">
                {s.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-300">{s.text}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <p className="mt-8 text-center font-mono text-[11.5px] uppercase tracking-[0.14em] text-ink-300">
          Read-only · deine Daten bleiben in deinen Tools
        </p>
      </Reveal>
    </Section>
  );
}
