'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Section } from './primitives';
import { Reveal } from './reveal';

/**
 * FAQ-Accordion. Ehrliche Antworten — Outlook-Limit nicht verstecken,
 * read-only-Realität klar benennen.
 */
const ITEMS = [
  {
    q: 'Funktioniert Ctrl+K mit Outlook?',
    a: 'Aktuell unterstützen wir Gmail. Outlook ist auf der Roadmap.',
  },
  {
    q: 'Wie sicher sind meine Mails?',
    a: 'Die Kontrolle bleibt bei dir: Ctrl+K liest read-only, gibt keine Daten weiter, und jede erkannte Zusage zeigt ihre Quelle. Deine Mails bleiben in deinem Postfach.',
  },
  {
    q: 'Liest die KI wirklich alles?',
    a: 'Nur was für deinen Plan nötig ist. Du siehst zu jeder Erkennung die Quelle und kannst sie verwerfen.',
  },
  {
    q: 'Ersetzt das Notion oder mein Mail-Programm?',
    a: 'Nein. Ctrl+K bündelt sie in einen Plan, statt dich zwischen Tabs wechseln zu lassen.',
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  const reduce = useReducedMotion();

  return (
    <Section className="py-20 sm:py-24">
      <div className="mx-auto max-w-2xl">
        <Reveal>
          <h2 className="text-center font-display text-[26px] font-semibold tracking-[-0.02em] text-ink-50 sm:text-[34px]">
            Häufige Fragen
          </h2>
        </Reveal>

        <Reveal delay={0.05}>
          <ul className="mt-10 flex flex-col divide-y divide-white/[0.07] border-y border-white/[0.07]">
            {ITEMS.map((item, i) => {
              const isOpen = open === i;
              return (
                <li key={item.q}>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-ink-50"
                  >
                    <span className="text-[15.5px] font-medium text-ink-50">{item.q}</span>
                    <span
                      aria-hidden
                      className={`shrink-0 text-ink-300 transition-transform duration-200 ease-soft ${
                        isOpen ? 'rotate-45 text-accent' : ''
                      }`}
                    >
                      +
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: reduce ? 0 : 0.28, ease: [0.23, 1, 0.32, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="pb-5 pr-8 text-[14.5px] leading-relaxed text-ink-300">
                          {item.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </Section>
  );
}
