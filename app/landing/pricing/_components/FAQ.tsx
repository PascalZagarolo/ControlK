'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { faqs } from '@/lib/pricing';

/**
 * Mini-FAQ-Accordion. Spiegelt das Muster der Landing-FAQ (divide-y,
 * rotierendes „+", AnimatePresence) — single-open für Ruhe, erstes Item
 * offen. Fragen kommen aus lib/pricing.
 */
export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  const reduce = useReducedMotion();

  return (
    <ul className="flex flex-col divide-y divide-white/[0.07] border-y border-white/[0.07]">
      {faqs.map((item, i) => {
        const isOpen = open === i;
        const panelId = `pricing-faq-panel-${i}`;
        return (
          <li key={item.q}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              aria-controls={panelId}
              className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <span className="text-[15.5px] font-medium text-ink-50">{item.q}</span>
              <span
                aria-hidden
                className={`shrink-0 text-[18px] leading-none text-ink-300 transition-transform duration-200 ease-soft ${
                  isOpen ? 'rotate-45 text-accent' : ''
                }`}
              >
                +
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={panelId}
                  role="region"
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
  );
}
