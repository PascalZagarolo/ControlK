import { Section } from './primitives';
import { Reveal } from './reveal';

/**
 * Vertrauen — drei kurze Signale, je eine Zeile. Kein Absatz.
 *
 * TODO(Pascal): Die DSGVO/EU-Server-Zeile NUR drinlassen, wenn es zutrifft
 * (Server-Standort + AVV verifiziert). Wenn nicht zutreffend: das erste
 * Objekt aus SIGNALS löschen — NICHT eine unbewiesene Aussage stehen lassen.
 */
const SIGNALS = [
  // TODO(Pascal): verifizieren — Server-Standort EU + DSGVO-Konformität.
  { icon: '🇪🇺', text: 'DSGVO-konform, Server in der EU' },
  {
    icon: '◆',
    text: 'Du behältst die Kontrolle — jede erkannte Zusage zeigt ihre Quelle und lässt sich mit einem Tap verwerfen',
  },
  { icon: '⊘', text: 'Keine Daten-Weitergabe' },
];

export function Trust() {
  return (
    <Section className="py-14 sm:py-16">
      <Reveal>
        <ul className="mx-auto flex max-w-4xl flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-8">
          {SIGNALS.map((s) => (
            <li
              key={s.text}
              className="flex items-center gap-2.5 text-[13px] leading-snug text-ink-200"
            >
              <span aria-hidden className="text-ink-300">
                {s.icon}
              </span>
              {s.text}
            </li>
          ))}
        </ul>
      </Reveal>
    </Section>
  );
}
