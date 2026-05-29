'use client';

/**
 * Live "now" indicator for the time-grid views. Renders an absolutely
 * positioned line within its parent (which must be `relative`), self-updates
 * every 30s, and tweens smoothly to the new position. A pulsing dot anchors
 * the left edge. The parent decides whether to mount it (i.e. only on today's
 * column / day), so this component just draws — it doesn't gate on the date.
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { EASE_SOFT } from './_motion';

export function NowLine({
  startHour,
  endHour,
  hourHeight,
  showLabel = false,
  labelLeft = 0,
}: {
  startHour: number;
  endHour: number;
  hourHeight: number;
  showLabel?: boolean;
  /** px offset for the "jetzt" label so it clears the hour-gutter. */
  labelLeft?: number;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const hourFloat = now.getHours() + now.getMinutes() / 60;
  if (hourFloat < startHour || hourFloat > endHour) return null;
  const top = (hourFloat - startHour) * hourHeight;

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 z-30"
      initial={false}
      animate={{ top }}
      transition={{ duration: 0.6, ease: EASE_SOFT }}
      style={{ top }}
    >
      <div className="relative">
        {/* Pulsing anchor dot */}
        <motion.span
          className="absolute -left-[3px] -top-[3px] h-[7px] w-[7px] rounded-full bg-[#5eb6ff]"
          style={{ boxShadow: '0 0 0 1px rgba(94,182,255,.4), 0 0 8px 2px rgba(94,182,255,.45)' }}
          animate={{ opacity: [1, 0.45, 1], scale: [1, 1.25, 1] }}
          transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity }}
        />
        <div
          className="h-px w-full"
          style={{ background: 'linear-gradient(90deg, #5eb6ff 0%, rgba(94,182,255,.35) 60%, transparent 100%)' }}
        />
        {showLabel && (
          <span
            className="absolute -top-[8px] rounded-full bg-[#5eb6ff] px-1 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.3px] text-black"
            style={{ left: labelLeft }}
          >
            {now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </motion.div>
  );
}
