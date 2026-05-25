'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import {
  addDays,
  addWeeks,
  formatISOWeek,
  formatWeekTitle,
  getISOWeek,
  parseISOWeek,
  startOfWeek,
} from '@/lib/calendar-time';

type View = 'day' | 'week' | 'month' | 'agenda' | 'inverse';

const VIEW_LABEL: Record<View, string> = {
  day: 'Tag',
  week: 'Woche',
  month: 'Monat',
  agenda: 'Agenda',
  inverse: 'Inverse',
};

function viewFromPath(pathname: string): View {
  if (pathname.startsWith('/calendar/day')) return 'day';
  if (pathname.startsWith('/calendar/month')) return 'month';
  if (pathname.startsWith('/calendar/agenda')) return 'agenda';
  if (pathname.startsWith('/calendar/inverse')) return 'inverse';
  return 'week';
}

function weekSlugFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/calendar\/week\/([^/]+)/);
  return m?.[1] ?? null;
}

export function CalendarSubheader({ pathname: serverPath }: { pathname: string }) {
  const clientPath = usePathname();
  const router = useRouter();
  // Prefer client pathname once mounted so navigation feels instant;
  // fall back to server-passed value during the first paint.
  const path = clientPath || serverPath;
  const view = viewFromPath(path);

  const today = new Date();
  let title = '';
  let prevHref = '#';
  let nextHref = '#';
  let isToday = true;

  if (view === 'week') {
    const slug = weekSlugFromPath(path);
    const anchor = (slug && parseISOWeek(slug)) || today;
    const weekStart = startOfWeek(anchor, 1);
    const weekEnd = addDays(weekStart, 6);
    title = formatWeekTitle(weekStart, weekEnd);
    prevHref = `/calendar/week/${formatISOWeek(addWeeks(weekStart, -1))}`;
    nextHref = `/calendar/week/${formatISOWeek(addWeeks(weekStart, 1))}`;
    const currentWeek = getISOWeek(today);
    const viewedWeek = getISOWeek(weekStart);
    isToday =
      currentWeek.year === viewedWeek.year && currentWeek.week === viewedWeek.week;
  } else if (view === 'day') {
    title = today.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  } else if (view === 'month') {
    title = today.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  } else if (view === 'agenda') {
    title = 'Agenda';
  } else {
    title = 'Stillstand · Vergessenes · Was ruht';
  }

  const goToday = () => {
    if (view === 'week') router.push('/calendar/week');
    else if (view === 'day') router.push('/calendar/day');
    else if (view === 'month') router.push('/calendar/month');
    else if (view === 'inverse') router.push('/calendar/inverse');
    else router.push('/calendar/agenda');
  };

  return (
    <div className="flex h-[56px] shrink-0 items-center gap-3 border-b border-[#1F1F23] bg-ink-900 px-6">
      <div className="flex items-center gap-1">
        <Link
          href={prevHref}
          aria-label="Vorheriger Zeitraum"
          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-300 transition-colors hover:bg-white/[0.05] hover:text-ink-50"
        >
          <ChevronLeft size={16} strokeWidth={2} />
        </Link>
        <Link
          href={nextHref}
          aria-label="Nächster Zeitraum"
          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-300 transition-colors hover:bg-white/[0.05] hover:text-ink-50"
        >
          <ChevronRight size={16} strokeWidth={2} />
        </Link>
        {!isToday && (
          <button
            type="button"
            onClick={goToday}
            className="ml-1 rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11.5px] text-ink-200 transition-colors hover:border-white/[0.16] hover:text-ink-50"
          >
            Heute
          </button>
        )}
      </div>

      <h1 className="min-w-0 flex-1 truncate text-[14px] font-medium leading-none text-ink-50">
        {title}
      </h1>

      <nav aria-label="Ansicht" className="flex items-center gap-0.5">
        {(['day', 'week', 'month', 'agenda', 'inverse'] as View[]).map((v) => (
          <Link
            key={v}
            href={`/calendar/${v}`}
            className={`relative px-3 py-1.5 text-[12px] font-medium transition-colors ${
              v === view ? 'text-[#FAFAFA]' : 'text-ink-300 hover:text-ink-100'
            }`}
          >
            {VIEW_LABEL[v]}
            {v === view && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-2 bottom-0 h-[2px] rounded-t bg-[#E8B86D]"
              />
            )}
          </Link>
        ))}
      </nav>

      <button
        type="button"
        disabled
        title="Termin-Erstellung kommt in Phase 2b"
        className="flex items-center gap-1.5 rounded-md bg-[#E8B86D]/[0.18] px-3 py-1.5 text-[12px] font-medium text-[#E8B86D] opacity-60"
      >
        <Plus size={13} strokeWidth={2.25} />
        <span>Neuer Termin</span>
      </button>
    </div>
  );
}
