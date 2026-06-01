'use client';

import { motion } from 'framer-motion';
import type { BillingPeriod } from '@/lib/pricing';

const OPTIONS: { id: BillingPeriod; label: string }[] = [
  { id: 'monthly', label: 'Monatlich' },
  { id: 'yearly', label: 'Jährlich' },
];

/**
 * Segmented Monatlich/Jährlich-Schalter. Controlled — der Parent hält den
 * Billing-State und gibt ihn an jede Card. Die aktive Pille gleitet über
 * einen shared-layout Thumb (framer-motion respektiert reduced-motion).
 */
export function BillingToggle({
  value,
  onChange,
}: {
  value: BillingPeriod;
  onChange: (next: BillingPeriod) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        role="group"
        aria-label="Abrechnungszeitraum"
        className="relative inline-flex rounded-full border border-white/[0.08] bg-white/[0.02] p-1"
      >
        {OPTIONS.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.id)}
              className={`relative rounded-full px-4 py-1.5 text-[13.5px] font-medium transition-colors duration-200 ease-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                active ? 'text-accent' : 'text-ink-300 hover:text-ink-50'
              }`}
            >
              {active && (
                <motion.span
                  aria-hidden
                  layoutId="billing-thumb"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-full border border-accent/25 bg-accent-soft"
                />
              )}
              <span className="relative z-10">{o.label}</span>
            </button>
          );
        })}
      </div>

      <p aria-live="polite" className="font-body text-[12.5px] text-accent/90">
        {value === 'yearly'
          ? 'Jährlich gewählt — 2 Monate gratis.'
          : 'Jährlich zahlen = 2 Monate gratis.'}
      </p>
    </div>
  );
}
