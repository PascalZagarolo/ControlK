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
}));
