'use client';

import { create } from 'zustand';

// Shared state for the active note's editing surface. Lives in zustand
// so siblings (Toolbar, TitleInput, Editor, TagsBar) can subscribe
// without prop-drilling through the page server component or wrapping
// the route in a context provider.
//
// The store key is the noteId — switching notes resets all fields.

type NoteSaveState = {
  noteId: string | null;
  title: string;
  saving: boolean;
  savedAt: Date | null;
  wordCount: number;

  // Setters
  hydrate: (input: { noteId: string; title: string }) => void;
  setTitle: (title: string) => void;
  setSaving: (saving: boolean) => void;
  setSavedAt: (savedAt: Date | null) => void;
  setWordCount: (wordCount: number) => void;
};

export const useNoteSaveStore = create<NoteSaveState>((set) => ({
  noteId: null,
  title: '',
  saving: false,
  savedAt: null,
  wordCount: 0,

  hydrate: ({ noteId, title }) =>
    set({ noteId, title, saving: false, savedAt: null, wordCount: 0 }),
  setTitle: (title) => set({ title }),
  setSaving: (saving) => set({ saving }),
  setSavedAt: (savedAt) => set({ savedAt }),
  setWordCount: (wordCount) => set({ wordCount }),
}));

// Counts whitespace-separated words in plain text. Used by NoteEditor
// after each debounced save, so the Toolbar can render an accurate
// count without re-deriving from the document.
export function countWordsInText(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
