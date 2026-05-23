'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { renameNote, setNoteIcon } from '@/lib/actions/notes';

export function NoteTitleInput({
  noteId,
  initialTitle,
  initialIcon,
}: {
  noteId: string;
  initialTitle: string;
  initialIcon?: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [icon, setIcon] = useState(initialIcon ?? '');
  const [iconOpen, setIconOpen] = useState(false);
  const [, start] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  useEffect(() => {
    setTitle(initialTitle);
    setIcon(initialIcon ?? '');
  }, [initialTitle, initialIcon]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }, [title]);

  const commitTitle = () => {
    const t = title.trim() || 'Unbenannt';
    if (t === initialTitle) return;
    start(async () => {
      await renameNote(noteId, t);
      router.refresh();
    });
  };

  const commitIcon = (next: string) => {
    setIcon(next);
    setIconOpen(false);
    start(async () => {
      await setNoteIcon(noteId, next || null);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <button
          type="button"
          onClick={() => setIconOpen((o) => !o)}
          className="flex h-12 w-12 items-center justify-center rounded-[10px] text-[28px] transition-colors hover:bg-white/[0.04]"
          aria-label="Icon ändern"
        >
          {icon || <span className="text-[18px] text-ink-300">＋</span>}
        </button>
        {iconOpen && (
          <div className="absolute left-0 top-14 z-20 flex flex-wrap gap-1.5 rounded-[12px] border border-white/[0.08] bg-[rgba(20,21,23,0.96)] p-2 backdrop-blur-xl">
            {['📝', '📋', '📌', '📅', '✏️', '💡', '⭐', '🎯', '🚐', '🔧', '🏡', '💼', '🎓', '🧠'].map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => commitIcon(e)}
                className="flex h-8 w-8 items-center justify-center rounded-[6px] text-[18px] hover:bg-white/[0.08]"
              >
                {e}
              </button>
            ))}
            <button
              type="button"
              onClick={() => commitIcon('')}
              className="flex h-8 w-8 items-center justify-center rounded-[6px] text-[14px] text-ink-300 hover:bg-white/[0.08]"
              title="Entfernen"
            >
              ∅
            </button>
          </div>
        )}
      </div>
      <textarea
        ref={ref}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            ref.current?.blur();
          }
        }}
        rows={1}
        spellCheck={false}
        placeholder="Unbenannt"
        className="resize-none border-0 bg-transparent text-[36px] font-medium leading-[1.15] tracking-[-0.4px] text-ink-50 outline-none placeholder:text-ink-300"
      />
    </div>
  );
}
