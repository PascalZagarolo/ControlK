import type { TodoPriority, TodoStatus } from '@/lib/types';

const STATUS_TONE: Record<TodoStatus, { bg: string; fg: string; dot: string; label: string }> = {
  offen: {
    bg: 'bg-white/[0.04]',
    fg: 'text-ink-200',
    dot: 'bg-ink-300',
    label: 'Offen',
  },
  in_arbeit: {
    bg: 'bg-[#5eb6ff]/12',
    fg: 'text-[#5eb6ff]',
    dot: 'bg-[#5eb6ff]',
    label: 'In Arbeit',
  },
  erledigt: {
    bg: 'bg-[#5ee08a]/12',
    fg: 'text-[#5ee08a]',
    dot: 'bg-[#5ee08a]',
    label: 'Erledigt',
  },
  abgebrochen: {
    bg: 'bg-white/[0.03]',
    fg: 'text-ink-300',
    dot: 'bg-ink-300',
    label: 'Abgebrochen',
  },
};

const PRIORITY_TONE: Record<TodoPriority, { fg: string; label: string; ring: string }> = {
  niedrig: { fg: 'text-ink-300', label: 'Niedrig', ring: 'ring-white/[0.06]' },
  mittel: { fg: 'text-ink-200', label: 'Mittel', ring: 'ring-white/[0.10]' },
  hoch: { fg: 'text-[#ffd96a]', label: 'Hoch', ring: 'ring-[#ffd96a]/30' },
  urgent: { fg: 'text-[#ff8a8a]', label: 'Urgent', ring: 'ring-[#ff8a8a]/40' },
};

export function StatusPill({ status }: { status: TodoStatus }) {
  const t = STATUS_TONE[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium leading-none ${t.bg} ${t.fg}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${t.dot}`} />
      {t.label}
    </span>
  );
}

export function PriorityPill({ priority }: { priority: TodoPriority }) {
  const t = PRIORITY_TONE[priority];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 ring-1 ${t.ring} font-mono text-[10px] uppercase tracking-[0.3px] ${t.fg}`}
    >
      {priority === 'urgent' && '!!! '}
      {priority === 'hoch' && '!! '}
      {t.label}
    </span>
  );
}

export function formatDue(iso: string | undefined, now = Date.now()): {
  label: string;
  tone: 'overdue' | 'today' | 'tomorrow' | 'soon' | 'later' | 'none';
} {
  if (!iso) return { label: '—', tone: 'none' };
  const t = new Date(iso).getTime();
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startTomorrow = startToday.getTime() + 86_400_000;
  const startDayAfter = startTomorrow + 86_400_000;

  if (t < now && t < startToday.getTime() + 0) {
    const days = Math.round((now - t) / 86_400_000);
    if (days === 0) {
      const h = new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      return { label: `Überfällig · ${h}`, tone: 'overdue' };
    }
    return { label: `Überfällig · ${days} ${days === 1 ? 'Tag' : 'Tage'}`, tone: 'overdue' };
  }
  if (t >= startToday.getTime() && t < startTomorrow) {
    const h = new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    return { label: `Heute · ${h}`, tone: 'today' };
  }
  if (t >= startTomorrow && t < startDayAfter) {
    const h = new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    return { label: `Morgen · ${h}`, tone: 'tomorrow' };
  }
  if (t - now < 7 * 86_400_000) {
    return {
      label: new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' }),
      tone: 'soon',
    };
  }
  return {
    label: new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' }),
    tone: 'later',
  };
}

const DUE_TONE_CLASS: Record<ReturnType<typeof formatDue>['tone'], string> = {
  overdue: 'text-[#ff8a8a]',
  today: 'text-[#5eb6ff]',
  tomorrow: 'text-[#5eb6ff]/70',
  soon: 'text-ink-200',
  later: 'text-ink-300',
  none: 'text-ink-300/60',
};

export function DuePill({ iso }: { iso: string | undefined }) {
  const d = formatDue(iso);
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.3px] ${DUE_TONE_CLASS[d.tone]}`}>
      {d.label}
    </span>
  );
}
