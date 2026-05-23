'use client';

import { useEffect } from 'react';

/**
 * Generic mobile bottom-sheet. Slides up from the bottom, dims the screen,
 * dismisses on backdrop tap / Escape / swipe-down (browser-native via
 * touch-action). No animation framework — pure CSS transitions.
 *
 * Use for: any mobile-first menu where a desktop dropdown would feel wrong.
 * The QuickCreate FAB + slash-menus on mobile route here.
 */
export function MobileBottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Prevent body scroll while sheet is up
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <div
      aria-hidden={!open}
      className={`fixed inset-0 z-[300] md:hidden ${open ? '' : 'pointer-events-none'}`}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ease-soft ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`absolute inset-x-0 bottom-0 rounded-t-[20px] border-t border-white/[0.08] bg-[rgba(14,15,18,0.98)] pb-[env(safe-area-inset-bottom,16px)] shadow-[0_-12px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-transform duration-240 ease-soft ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Drag handle (visual only — browser native touch handles dismissal) */}
        <div className="flex justify-center pt-2.5 pb-1">
          <span className="h-1 w-10 rounded-full bg-white/[0.15]" />
        </div>
        {title && (
          <div className="border-b border-white/[0.06] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            {title}
          </div>
        )}
        <div className="max-h-[70vh] overflow-y-auto px-3 py-2">{children}</div>
      </div>
    </div>
  );
}
