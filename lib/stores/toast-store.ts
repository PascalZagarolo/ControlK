'use client';

import { create } from 'zustand';

// Tiny toast system. Designed for one-line confirmations after
// optimistic actions ("Archiviert", "→ Todo erstellt") — not a
// full notification framework. If we ever need stacked toasts with
// undo affordances, swap for sonner.

export type ToastTone = 'default' | 'success' | 'danger';

export type Toast = {
  id: string;
  message: string;
  tone: ToastTone;
  // Auto-dismiss delay in ms. The host component manages the timer
  // so the store stays a pure event log.
  ttl: number;
};

type ToastState = {
  toasts: Toast[];
  push: (input: { message: string; tone?: ToastTone; ttl?: number }) => string;
  dismiss: (id: string) => void;
};

let _counter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: ({ message, tone = 'default', ttl = 2200 }) => {
    const id = `t${++_counter}-${Date.now()}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, tone, ttl }] }));
    return id;
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/**
 * Convenience helper for fire-and-forget calls. Doesn't return the id
 * because the caller almost never needs it.
 */
export function toast(
  message: string,
  tone: ToastTone = 'default'
): void {
  useToastStore.getState().push({ message, tone });
}
