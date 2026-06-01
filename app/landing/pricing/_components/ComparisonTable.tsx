'use client';

import { Fragment, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { type TierId, comparisonRows, tiers } from '@/lib/pricing';

const ORDER: TierId[] = ['free', 'solo', 'team'];

/** Cell content: indigo tick (included), em-dash (not), or verbatim text. */
function CellContent({ value }: { value: string | boolean }) {
  if (value === true) {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        role="img"
        aria-label="enthalten"
        className="inline-block text-accent"
      >
        <path
          d="M2.5 7.5L5.5 10.5L11.5 3.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (value === false) {
    return (
      <span className="text-ink-500" aria-label="nicht enthalten">
        —
      </span>
    );
  }
  return <>{value}</>;
}

/**
 * Optionaler, standardmäßig eingeklappter Funktionsvergleich. Native
 * <table> — korrekte Semantik (th scope, colgroup-Überschriften) für
 * Screenreader. Nur reale Features (jede Zeile bildet eine Tier-Fähigkeit
 * aus lib/pricing ab). Auf schmalen Screens scrollt die Tabelle horizontal.
 */
export function ComparisonTable() {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex justify-center">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.02] px-4 py-2 text-[13.5px] text-ink-300 transition-colors duration-200 ease-soft hover:border-white/24 hover:text-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <span>{open ? 'Vergleich ausblenden' : 'Alle Funktionen vergleichen'}</span>
          <span
            aria-hidden
            className={`text-[13px] leading-none transition-transform duration-200 ease-soft ${
              open ? 'rotate-180' : ''
            }`}
          >
            ⌄
          </span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.32, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-7 overflow-x-auto">
              <div className="min-w-[560px] overflow-hidden rounded-2xl border border-white/[0.07]">
                <table className="w-full table-fixed border-collapse text-left">
                  <caption className="sr-only">
                    Funktionsvergleich der Tarife Free, Solo und Team
                  </caption>
                  <colgroup>
                    <col className="w-[37%]" />
                    <col />
                    <col />
                    <col />
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col" className="px-4 py-3" />
                      {ORDER.map((id) => {
                        const tier = tiers.find((t) => t.id === id)!;
                        const solo = id === 'solo';
                        return (
                          <th
                            key={id}
                            scope="col"
                            className={`px-3 py-3 text-center font-display text-[13px] font-medium ${
                              solo ? 'bg-accent/5 text-accent' : 'text-ink-50'
                            }`}
                          >
                            {tier.name}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map((row) => (
                      <Fragment key={row.label}>
                        {row.group && (
                          <tr>
                            <th
                              scope="colgroup"
                              colSpan={4}
                              className="border-t border-white/[0.06] px-4 pb-2 pt-4 text-left font-mono text-[10.5px] font-normal uppercase tracking-[0.12em] text-ink-300"
                            >
                              {row.group}
                            </th>
                          </tr>
                        )}
                        <tr>
                          <th
                            scope="row"
                            className="border-t border-white/[0.06] px-4 py-3 text-left text-[13px] font-normal leading-[1.45] text-ink-300"
                          >
                            {row.label}
                          </th>
                          {ORDER.map((id) => {
                            const v = row.values[id];
                            const solo = id === 'solo';
                            const isStr = typeof v === 'string';
                            return (
                              <td
                                key={id}
                                className={`border-t border-white/[0.06] px-3 py-3 text-center align-middle ${
                                  solo ? 'bg-accent/5 ' : ''
                                }${isStr ? `text-[12.5px] ${solo ? 'text-ink-50' : 'text-ink-300'}` : ''}`}
                              >
                                <CellContent value={v} />
                              </td>
                            );
                          })}
                        </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
