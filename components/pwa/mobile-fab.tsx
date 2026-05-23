'use client';

import { useEffect, useState } from 'react';
import { useUIStore } from '@/lib/stores/ui-store';

/**
 * Floating action button shown only on mobile (sm breakpoint and below)
 * for one-tap voice/quick capture. On desktop the same flow is reachable
 * via ⌘N — the FAB exists purely so PWA users on phones can capture without
 * pinching to find a button.
 */
export function MobileFab() {
  const setQuickCreate = useUIStore((s) => s.setQuickCreateOpen);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <button
      type="button"
      aria-label="Schnellcapture"
      onClick={() => setQuickCreate(true)}
      className="fixed bottom-6 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-white text-black shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition-transform active:scale-95 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  );
}
