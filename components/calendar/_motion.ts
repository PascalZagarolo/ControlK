/**
 * Shared motion vocabulary for the calendar redesign.
 *
 * Curves and tempos are taken straight from DESIGN.md §6:
 *  - UI feedback lives in the 150–300ms band on a soft decelerating curve.
 *  - The "soft" curve (.23,1,.32,1) is the house transition; the overshoot
 *    pop (.34,1.56,.64,1) is reserved for drops/confirmations.
 * Keep calendar motion inside these two tempos — mixing reads as wrong.
 */
import type { Transition, Variants } from 'framer-motion';

// cubic-bezier control points (framer-motion takes them as 4-tuples)
export const EASE_SOFT = [0.23, 1, 0.32, 1] as const;
export const EASE_POP = [0.34, 1.56, 0.64, 1] as const;
export const EASE_OUT = [0.215, 0.61, 0.355, 1] as const;

/** Spring used when an event lands after a drag — a small, contained bounce. */
export const DROP_SPRING: Transition = { type: 'spring', stiffness: 520, damping: 32, mass: 0.7 };

/** Event chip entrance — fade + lift, staggered by the parent. */
export const chipVariants: Variants = {
  hidden: { opacity: 0, y: 4, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.22, ease: EASE_SOFT } },
};

/** Container that staggers its chip children into view. */
export const gridStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.012, delayChildren: 0.02 } },
};

/** Drawer / popover slide-in from the right. */
export const drawerVariants: Variants = {
  hidden: { opacity: 0, x: 24 },
  show: { opacity: 1, x: 0, transition: { duration: 0.28, ease: EASE_SOFT } },
  exit: { opacity: 0, x: 24, transition: { duration: 0.18, ease: EASE_OUT } },
};

/** Backdrop fade for modal/drawer scrims. */
export const scrimVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: 0.16, ease: EASE_OUT } },
};
