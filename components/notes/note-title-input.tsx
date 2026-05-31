'use client';

import { useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { renameNote } from '@/lib/actions/notes';
import { useNoteSaveStore } from '@/lib/notes/note-save-store';
import { toast } from '@/lib/stores/toast-store';

/**
 * Plain editable title — no background, no border, no icon picker. Sits
 * directly on the canvas above the editor body.
 *
 * Writes to the shared save-state store so the toolbar's breadcrumb
 * updates instantly. Persists to the server on blur (and on each
 * keystroke via the debounced save loop inside the store consumer if
 * we want it; for now blur-only keeps the action-write rate sane).
 */
export function NoteTitleInput({
  noteId,
  initialTitle,
}: {
  noteId: string;
  initialTitle: string;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);
  const hydrate = useNoteSaveStore((s) => s.hydrate);
  const setTitle = useNoteSaveStore((s) => s.setTitle);
  // We bind value to the store so the textarea stays in sync if any
  // other surface (autosave callback, undo, etc.) writes to it.
  const title = useNoteSaveStore((s) =>
    s.noteId === noteId ? s.title : initialTitle
  );

  // First mount + note switch: hydrate the store with the canonical
  // server title so the toolbar breadcrumb has something to show before
  // the user types.
  useEffect(() => {
    hydrate({ noteId, title: initialTitle });
  }, [hydrate, noteId, initialTitle]);

  // Auto-resize textarea so multi-line titles wrap cleanly.
  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }, [title]);

  const commitTitle = () => {
    const next = title.trim();
    if (next === initialTitle.trim()) return;
    start(async () => {
      const res = await renameNote(noteId, next || 'Unbenannt');
      if (!res.ok) {
        toast(res.error || 'Titel konnte nicht gespeichert werden.', 'danger');
        return;
      }
      router.refresh();
    });
  };

  return (
    <textarea
      ref={ref}
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={commitTitle}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          // Hand focus to the editor body. BlockNote mounts in a sibling
          // node — look for the first focusable [contenteditable] inside
          // the .bn-container wrapper.
          const editor = document.querySelector<HTMLElement>(
            '.bn-container [contenteditable="true"]'
          );
          editor?.focus();
        }
      }}
      rows={1}
      spellCheck={false}
      placeholder="Titel"
      className="resize-none border-0 bg-transparent text-[28px] font-medium leading-[1.2] tracking-[-0.02em] text-[#FAFAFA] outline-none placeholder:text-[#52525B]"
    />
  );
}
