// ─── Flow status tokens — central colour/label source ───────────────
//
// ONE place where the three flow states map to colour + label, so the list
// view, the flow-chart view (and anything else) share the exact same code
// instead of hardcoding hex per component (Prompt requirement).
//
// Colours are the app's REAL theme tokens (see DESIGN.md / tailwind.config):
//   - active  → #E8B86D  the Ctrl+K sand/gold accent (used app-wide for the
//                        single "jetzt dran / fällig" signal). Used SPARINGLY:
//                        only the one active step.
//   - done    → #6a6b6c  grey-300, muted/neutral.
//   - waiting → #434345  grey-400, dimmed/ausgegraut (blocked).
//
// No imports — usable from server, client, and tests alike.

import type { StepState } from './sequence';

export type FlowStatusToken = {
  /** Locked-caps label shown in nodes/rows: ERLEDIGT / AKTIV / WARTET. */
  label: string;
  /** Foreground accent for the state. */
  color: string;
  /** 15%-ish translucent fill for chips/node backgrounds. */
  bg: string;
  /** Border colour for the node/row in this state. */
  border: string;
  /** Row/node opacity — waiting is dimmed to read as "noch nicht dran". */
  opacity: number;
};

export const FLOW_STATUS: Record<StepState, FlowStatusToken> = {
  done: {
    label: 'ERLEDIGT',
    color: '#6a6b6c',
    bg: 'rgba(106,107,108,0.10)',
    border: 'rgba(255,255,255,0.06)',
    opacity: 1,
  },
  active: {
    label: 'AKTIV',
    color: '#E8B86D', // sand/gold — the single highlighted step
    bg: 'rgba(232,184,109,0.12)',
    border: 'rgba(232,184,109,0.45)',
    opacity: 1,
  },
  waiting: {
    label: 'WARTET',
    color: '#434345',
    bg: 'rgba(67,67,69,0.10)',
    border: 'rgba(255,255,255,0.05)',
    opacity: 0.55,
  },
};

// Edge tokens — solid for the already-walked path, dashed+dim for upcoming.
export const FLOW_EDGE = {
  traversed: { stroke: '#6a6b6c', dash: undefined as string | undefined, width: 1.75 },
  upcoming: { stroke: '#434345', dash: '5 4', width: 1.5 },
};

// Neutral dark canvas — Ctrl+K aesthetic, NOT a bluish near-black.
export const FLOW_CANVAS_BG = '#111214'; // grey-700
export const FLOW_DOT_COLOR = '#1b1c1e'; // grey-600
