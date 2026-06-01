'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { type BillingPeriod, tiers } from '@/lib/pricing';
import { BillingToggle } from './BillingToggle';
import { PricingCard } from './PricingCard';

/**
 * Interaktive Insel: hält den Billing-Zeitraum und treibt alle drei Cards.
 * Cards faden gestaffelt ein, behalten gleiche Höhe (CTAs unten bündig) und
 * stellen Solo auf Mobile nach vorn.
 */
export function PricingSection() {
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const reduce = useReducedMotion();

  return (
    <div>
      <div className="flex justify-center">
        <BillingToggle value={period} onChange={setPeriod} />
      </div>

      <div className="mx-auto mt-12 grid max-w-5xl gap-4 sm:gap-5 lg:grid-cols-3">
        {tiers.map((tier, i) => (
          <motion.div
            key={tier.id}
            className={`h-full ${tier.highlighted ? 'order-first lg:order-none' : ''}`}
            initial={{ opacity: 0, y: reduce ? 0 : 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '0px 0px -12% 0px' }}
            transition={{ duration: 0.5, delay: Math.min(i * 0.07, 0.2), ease: [0.23, 1, 0.32, 1] }}
          >
            <PricingCard tier={tier} period={period} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
