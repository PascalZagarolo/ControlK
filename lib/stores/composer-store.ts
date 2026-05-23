'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type ComposerState = {
  drafts: Record<string, string>;
  setDraft: (key: string, value: string) => void;
  clearDraft: (key: string) => void;
};

export const useComposerStore = create<ComposerState>()(
  persist(
    (set) => ({
      drafts: {},
      setDraft: (key, value) =>
        set((s) => ({
          drafts: { ...s.drafts, [key]: value },
        })),
      clearDraft: (key) =>
        set((s) => {
          const { [key]: _omit, ...rest } = s.drafts;
          return { drafts: rest };
        }),
    }),
    {
      name: 'urent:composer-drafts',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
