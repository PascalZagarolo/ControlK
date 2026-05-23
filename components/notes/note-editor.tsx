'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import type { Block, PartialBlock } from '@blocknote/core';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import { saveNoteDocument } from '@/lib/actions/notes';

type Props = {
  noteId: string;
  initialDocument: unknown;
  readOnly?: boolean;
};

/**
 * Wraps BlockNote with our auto-save loop and dark-mode styling.
 * - Auto-save: debounced 800ms after the last edit.
 * - Initial content: hydrated from server-passed JSON blocks.
 * - Read-only: rendered without slash-menu / drag-handles when previewing.
 */
export function NoteEditor({ noteId, initialDocument, readOnly }: Props) {
  const initialBlocks = useMemo<PartialBlock[] | undefined>(() => {
    if (!Array.isArray(initialDocument)) return undefined;
    if (initialDocument.length === 0) return undefined;
    return initialDocument as PartialBlock[];
  }, [initialDocument]);

  const editor = useCreateBlockNote({
    initialContent: initialBlocks,
  });

  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSerializedRef = useRef<string>(JSON.stringify(initialBlocks ?? []));

  useEffect(() => {
    if (readOnly) return;
    const off = editor.onChange(() => {
      // Debounce saves
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        const blocks = editor.document as Block[];
        const next = JSON.stringify(blocks);
        if (next === lastSerializedRef.current) return;
        lastSerializedRef.current = next;
        setSaving(true);
        try {
          await saveNoteDocument(noteId, blocks);
          setSavedAt(new Date());
        } finally {
          setSaving(false);
        }
      }, 800);
    });
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (typeof off === 'function') off();
    };
  }, [editor, noteId, readOnly]);

  return (
    <div className="note-editor-shell">
      <BlockNoteView editor={editor} editable={!readOnly} theme="dark" />
      {!readOnly && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-10 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          {saving
            ? 'Speichere …'
            : savedAt
              ? `Gespeichert · ${savedAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : ''}
        </div>
      )}
      {/* Override BlockNote defaults for our dark dense aesthetic */}
      <style jsx global>{`
        .note-editor-shell .bn-editor {
          padding-top: 8px;
          padding-bottom: 240px;
        }
        .note-editor-shell .bn-container {
          background: transparent !important;
        }
        .note-editor-shell .bn-editor,
        .note-editor-shell .bn-editor p,
        .note-editor-shell .bn-editor li,
        .note-editor-shell .bn-editor h1,
        .note-editor-shell .bn-editor h2,
        .note-editor-shell .bn-editor h3 {
          color: #e6e7ec;
        }
        .note-editor-shell .bn-editor h1 {
          font-size: 28px;
          font-weight: 500;
          letter-spacing: -0.3px;
        }
        .note-editor-shell .bn-editor h2 {
          font-size: 22px;
          font-weight: 500;
          letter-spacing: -0.2px;
        }
        .note-editor-shell .bn-editor h3 {
          font-size: 18px;
          font-weight: 500;
        }
        .note-editor-shell [data-content-type='paragraph'] {
          font-size: 14.5px;
          line-height: 1.6;
        }
        .note-editor-shell .bn-slash-menu,
        .note-editor-shell .mantine-Menu-dropdown {
          background: rgba(20, 21, 23, 0.96) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          backdrop-filter: blur(12px);
        }
      `}</style>
    </div>
  );
}
