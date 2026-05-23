'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/lib/stores/ui-store';

/**
 * Global keyboard surface. Keep shortcuts here so they're discoverable
 * (single file) and don't fight with editor-internal shortcuts.
 *
 *   ⌘K  · Command Palette
 *   ⌘T  · Quick-Create (todo/event)
 *   ⌘B  · Daily Brief
 *   ⌘N  · New Note (jumps to /notes empty-state, which has the picker)
 *   ⌘.  · Open ai-settings (BYOK)
 *
 * Ignored when focus is inside contenteditable, input, textarea so we don't
 * intercept typing.
 */
function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

export function KeyboardListener() {
  const router = useRouter();
  const toggleCmdK = useUIStore((s) => s.toggleCmdK);
  const toggleQuickCreate = useUIStore((s) => s.toggleQuickCreate);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();

      // ⌘K always works, even in inputs — global search is expected
      if (k === 'k') {
        e.preventDefault();
        toggleCmdK();
        return;
      }

      // For everything else, don't fight with the user typing
      if (isTypingTarget(e.target)) return;

      if (k === 't') {
        e.preventDefault();
        toggleQuickCreate();
      } else if (k === 'b') {
        e.preventDefault();
        router.push('/todos/brief');
      } else if (k === 'n') {
        e.preventDefault();
        router.push('/notes');
      } else if (k === '.') {
        e.preventDefault();
        router.push('/settings/ai');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [toggleCmdK, toggleQuickCreate, router]);

  return null;
}
