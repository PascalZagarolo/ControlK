'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * Tiny fade-in + translateY wrapper for landing sections. Triggers once
 * per element when ~25% in view. Respects prefers-reduced-motion via
 * framer-motion's built-in handling.
 */
export function Reveal({
  children,
  delay = 0,
  y = 12,
  duration = 0.42,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  duration?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
