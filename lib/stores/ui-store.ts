'use client';

import { create } from 'zustand';

type UIState = {
  cmdKOpen: boolean;
  setCmdKOpen: (open: boolean) => void;
  toggleCmdK: () => void;

  switcherOpen: boolean;
  setSwitcherOpen: (open: boolean) => void;

  quickCreateOpen: boolean;
  setQuickCreateOpen: (open: boolean) => void;
  toggleQuickCreate: () => void;

  // Ask Ctrl K assistant. `askQuery` carries an initial question (e.g. from
  // the ⌘K palette) that the panel auto-sends once on open.
  askOpen: boolean;
  askQuery: string | null;
  setAskOpen: (open: boolean) => void;
  openAsk: (query?: string) => void;
};

export const useUIStore = create<UIState>((set) => ({
  cmdKOpen: false,
  setCmdKOpen: (cmdKOpen) => set({ cmdKOpen }),
  toggleCmdK: () => set((s) => ({ cmdKOpen: !s.cmdKOpen })),

  switcherOpen: false,
  setSwitcherOpen: (switcherOpen) => set({ switcherOpen }),

  quickCreateOpen: false,
  setQuickCreateOpen: (quickCreateOpen) => set({ quickCreateOpen }),
  toggleQuickCreate: () => set((s) => ({ quickCreateOpen: !s.quickCreateOpen })),

  askOpen: false,
  askQuery: null,
  setAskOpen: (askOpen) => set(askOpen ? { askOpen } : { askOpen, askQuery: null }),
  openAsk: (query) => set({ askOpen: true, askQuery: query ?? null }),
}));
