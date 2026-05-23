import type { CalendarEventKind } from '@/lib/types';

export const KIND_META: Record<
  CalendarEventKind,
  { label: string; color: string; icon: string }
> = {
  handover: { label: 'Übergabe', color: '#5ee08a', icon: '↗' },
  return: { label: 'Rückgabe', color: '#5eb6ff', icon: '↙' },
  internal: { label: 'Intern', color: '#c084fc', icon: '·' },
  maintenance: { label: 'Wartung', color: '#ffd96a', icon: '🔧' },
};

export function colorForKind(kind: CalendarEventKind): string {
  return KIND_META[kind]?.color ?? '#9c9c9d';
}
