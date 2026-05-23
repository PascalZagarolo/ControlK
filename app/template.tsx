'use client';

/**
 * Module → module entry transition.
 *
 * Next.js App Router re-mounts this template on every navigation (unlike
 * layout.tsx which persists). We key the wrapper by pathname so route
 * changes trigger a fresh entry animation.
 *
 * The motion: a small upward translation (8px) paired with an opacity fade.
 * Read as "the new room rises gently into view." Subtle enough that the user
 * doesn't consciously notice it — but the absence of it would feel like
 * jump-cuts between pages. That's the entire point of the spatial layer:
 * invisible-but-felt continuity.
 *
 * Why slide UP, not down or sideways:
 *   - Up = forward motion (down would feel like "falling back")
 *   - Vertical-only avoids the politics of left/right (no nav-direction
 *     state to track, no "this module is to the right of that one" model)
 *   - It composes cleanly with the foyer's doorway (which sweeps vertically)
 *     so the whole language stays on one axis
 *
 * Sequencing with the foyer's doorway:
 *
 *   1. User clicks module link on foyer
 *   2. Doorway overlay plays for ~500ms on foyer DOM
 *   3. router.push fires → foyer unmounts, doorway unmounts with it
 *   4. New module page mounts inside this template → slides up + fades in
 *
 * For module → module navigation (no doorway), only step 4 runs.
 *
 * Layout-level chrome (Header, CmdK, MobileFab, HelpButton, RegisterSW)
 * sits in app/layout.tsx, so it stays mounted and steady across navigations
 * — only the page-content area animates. The chrome is the building; only
 * the rooms swap.
 *
 * Query-param changes (e.g. /todos?view=today) do NOT re-mount because the
 * pathname key is identical. Filter/sort changes stay snappy.
 *
 * Respects prefers-reduced-motion: useReducedMotion returns true → both
 * opacity-fade and translation collapse to 0ms.
 */

import { motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  // Cheap easeOut feels right here — calm arrival, no expressive overshoot.
  // The doorway gets the expressive Material curve; module-to-module stays
  // neutral so it doesn't compete with the doorway's drama.
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <motion.div
      key={pathname}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition}
      // willChange hint helps the compositor on lower-end devices —
      // restricted to this short-lived motion, not a permanent style.
      style={{ willChange: 'transform, opacity' }}
    >
      {children}
    </motion.div>
  );
}
