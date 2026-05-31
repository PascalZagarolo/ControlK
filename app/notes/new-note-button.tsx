'use client';

import { useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createNote } from '@/lib/actions/notes';
import { markFreshNote } from '@/lib/notes/optimistic-notes';
import { toast } from '@/lib/stores/toast-store';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The insert runs in the background; a transient failure shouldn't strand the
// note. Retry a few times before giving up.
async function createNoteWithRetry(id: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await createNote({ id, title: '' });
      if (res.ok) return true;
    } catch {
      // network/transient — fall through to retry
    }
    await sleep(200 * (attempt + 1));
  }
  return false;
}

/**
 * Inline trigger that creates an empty note and navigates straight into
 * the editor. No modal, no "give it a title first" step — the page just
 * opens with focus already inside the title input.
 */
export function NewNoteButton({
  variant = 'ghost',
  label = '+ Neue Notiz',
}: {
  variant?: 'ghost' | 'primary';
  label?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Synchronous guard: `pending` from useTransition updates asynchronously, so
  // a fast double-click could otherwise mint two ids and create two notes.
  const creating = useRef(false);

  const onClick = () => {
    if (creating.current) return;
    creating.current = true;
    // Optimistic: mint the id on the client and navigate into the editor
    // immediately. The insert runs in the background against that same id, so
    // the page render and the DB write overlap instead of stacking up.
    const id = crypto.randomUUID();
    // Tell the destination page this id is brand new → it opens the editor
    // instantly with empty defaults instead of waiting on a server render.
    markFreshNote(id);
    start(() => {
      router.push(`/notes/${id}`);
    });
    createNoteWithRetry(id)
      .then((ok) => {
        if (!ok) {
          // Don't redirect away — the user may have already typed, and that
          // text lives in the editor + IndexedDB. Yanking them to /notes would
          // orphan it. Keep them in place with an honest message instead.
          toast(
            'Notiz konnte nicht gespeichert werden — dein Text bleibt im Editor. Bitte später erneut versuchen oder Inhalt kopieren.',
            'danger'
          );
        }
      })
      .finally(() => {
        creating.current = false;
      });
  };

  const baseClass =
    'inline-flex items-center gap-1.5 rounded-md text-[12.5px] leading-none transition-colors duration-150 disabled:opacity-50';
  const styleByVariant = {
    ghost:
      'px-2.5 py-1.5 text-[#A1A1AA] hover:bg-white/[0.04] hover:text-[#E8B86D]',
    primary:
      'px-3.5 py-2 bg-[#E8B86D] text-[#0A0A0C] hover:bg-[#F0C079] font-medium',
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`${baseClass} ${styleByVariant[variant]}`}
    >
      {pending ? 'Lege an …' : label}
    </button>
  );
}
