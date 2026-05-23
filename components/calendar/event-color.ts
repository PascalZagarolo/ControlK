import type { CalendarEventKind } from '@/lib/types';

export type KindGroup = 'general' | 'rental' | 'workspace';

export const KIND_META: Record<
  CalendarEventKind,
  { label: string; color: string; icon: string; group: KindGroup }
> = {
  // ─── Allgemein ──────────────────────────────────────────────
  meeting: { label: 'Meeting', color: '#c084fc', icon: '👥', group: 'general' },
  call: { label: 'Anruf', color: '#5eb6ff', icon: '📞', group: 'general' },
  focus: { label: 'Fokus', color: '#5ee08a', icon: '🧠', group: 'general' },
  task: { label: 'Block', color: '#9c9c9d', icon: '▪', group: 'general' },
  personal: { label: 'Privat', color: '#ffb45e', icon: '◐', group: 'general' },
  health: { label: 'Arzt / Gesundheit', color: '#ff8a8a', icon: '✚', group: 'general' },
  travel: { label: 'Reise', color: '#5eb6ff', icon: '✈', group: 'general' },
  other: { label: 'Sonstiges', color: '#7d7d7d', icon: '·', group: 'general' },

  // ─── Vermietung (uRent) ─────────────────────────────────────
  handover: { label: 'Übergabe', color: '#5ee08a', icon: '↗', group: 'rental' },
  return: { label: 'Rückgabe', color: '#5eb6ff', icon: '↙', group: 'rental' },
  maintenance: { label: 'Wartung', color: '#ffd96a', icon: '🔧', group: 'rental' },

  // ─── Workspace ──────────────────────────────────────────────
  internal: { label: 'Intern', color: '#c084fc', icon: '⌂', group: 'workspace' },
};

export const KIND_GROUPS: { key: KindGroup; label: string; kinds: CalendarEventKind[] }[] = [
  {
    key: 'general',
    label: 'Allgemein',
    kinds: ['meeting', 'call', 'focus', 'task', 'personal', 'health', 'travel', 'other'],
  },
  {
    key: 'rental',
    label: 'Vermietung',
    kinds: ['handover', 'return', 'maintenance'],
  },
  {
    key: 'workspace',
    label: 'Workspace',
    kinds: ['internal'],
  },
];

export function colorForKind(kind: CalendarEventKind): string {
  return KIND_META[kind]?.color ?? '#9c9c9d';
}
