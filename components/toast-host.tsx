'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useToastStore, type Toast } from '@/lib/stores/toast-store';

const TONE_STYLES: Record<Toast['tone'], { bg: string; border: string; text: string }> = {
  default: {
    bg: 'rgba(20, 21, 23, 0.96)',
    border: 'rgba(255, 255, 255, 0.08)',
    text: '#E5E5E7',
  },
  success: {
    bg: 'rgba(232, 184, 109, 0.10)',
    border: 'rgba(232, 184, 109, 0.30)',
    text: '#E8B86D',
  },
  danger: {
    bg: 'rgba(255, 99, 99, 0.10)',
    border: 'rgba(255, 99, 99, 0.30)',
    text: '#ff9b9b',
  },
};

/**
 * Bottom-center toast host. Mounted once in the root layout — anywhere
 * in the app can call `toast(message)` from the store and it lands here.
 *
 * Stack-aware: multiple toasts queue vertically, newest at the bottom.
 * Each manages its own auto-dismiss timer based on the ttl set when it
 * was pushed.
 */
export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div
      className="pointer-events-none fixed bottom-6 left-1/2 z-[1100] flex -translate-x-1/2 flex-col items-center gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const prefersReducedMotion = useReducedMotion();
  const style = TONE_STYLES[toast.tone];

  useEffect(() => {
    const id = window.setTimeout(() => dismiss(toast.id), toast.ttl);
    return () => window.clearTimeout(id);
  }, [toast.id, toast.ttl, dismiss]);

  return (
    <motion.div
      role="status"
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={
        prefersReducedMotion
          ? { opacity: 0 }
          : { opacity: 0, y: 8, transition: { duration: 0.18 } }
      }
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-auto rounded-full border px-4 py-2 text-[13px] leading-none backdrop-blur-xl"
      style={{
        background: style.bg,
        borderColor: style.border,
        color: style.text,
      }}
    >
      {toast.message}
    </motion.div>
  );
}
