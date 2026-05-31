'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createNote } from '@/lib/actions/notes';
import { toast } from '@/lib/stores/toast-store';

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

  const onClick = () => {
    if (pending) return;
    // Optimistic: mint the id on the client and navigate into the editor
    // immediately. The insert runs in the background against that same id, so
    // the page render and the DB write overlap instead of stacking up.
    const id = crypto.randomUUID();
    start(() => {
      router.push(`/notes/${id}`);
    });
    createNote({ id, title: '' }).then((res) => {
      if (!res.ok) {
        toast(res.error || 'Notiz konnte nicht angelegt werden.', 'danger');
        router.push('/notes');
      }
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
