'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/lib/stores/ui-store';

export function KeyboardListener() {
  const toggleCmdK = useUIStore((s) => s.toggleCmdK);
  const toggleQuickCreate = useUIStore((s) => s.toggleQuickCreate);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 'k') {
        e.preventDefault();
        toggleCmdK();
      } else if (k === 't') {
        e.preventDefault();
        toggleQuickCreate();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [toggleCmdK, toggleQuickCreate]);

  return null;
}
