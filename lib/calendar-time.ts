// Minimal date-math for the calendar UI. Native Date only — no
// date-fns, no luxon. The existing repo uses Intl APIs for all date
// formatting and that pattern carries us comfortably through week +
// month views. If we hit a timezone wall later we'll add date-fns-tz,
// but for read-only display in the user's local TZ this is enough.

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addWeeks(d: Date, n: number): Date {
  return addDays(d, n * 7);
}

/**
 * Start of week respecting user preference. weekStartsOn: 0 = Sunday,
 * 1 = Monday (default in DE).
 */
export function startOfWeek(d: Date, weekStartsOn: 0 | 1 = 1): Date {
  const dt = startOfDay(d);
  const day = dt.getDay(); // 0 = Sun .. 6 = Sat
  const diff = (day - weekStartsOn + 7) % 7;
  dt.setDate(dt.getDate() - diff);
  return dt;
}

export function endOfWeek(d: Date, weekStartsOn: 0 | 1 = 1): Date {
  const s = startOfWeek(d, weekStartsOn);
  const e = new Date(s);
  e.setDate(e.getDate() + 7);
  e.setMilliseconds(-1);
  return e;
}

// ─── ISO week (year + week number) ──────────────────────────────
// Independent of locale. Week 1 contains Jan 4 / first Thursday.

export function getISOWeek(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7
  );
  return { year: date.getUTCFullYear(), week: weekNum };
}

export function formatISOWeek(d: Date): string {
  const { year, week } = getISOWeek(d);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

/**
 * Parses '2026-W21' to the Monday (local) of that ISO week. Returns
 * null on malformed input — caller falls back to current week.
 */
export function parseISOWeek(s: string): Date | null {
  const m = s.match(/^(\d{4})-W(\d{1,2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);
  if (week < 1 || week > 53) return null;
  // Week 1 contains Jan 4. Find Monday of week-containing-Jan-4, then
  // jump (week-1) weeks forward.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const result = new Date(week1Monday);
  result.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return new Date(result.getUTCFullYear(), result.getUTCMonth(), result.getUTCDate());
}

// ─── Formatting ─────────────────────────────────────────────────

export function formatHHMM(d: Date): string {
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function formatDayHeader(d: Date): { weekday: string; day: number } {
  return {
    weekday: d.toLocaleDateString('de-DE', { weekday: 'short' }),
    day: d.getDate(),
  };
}

/**
 * "Woche 21 · 18.–24. Mai" or, when crossing months,
 * "Woche 21 · 28. April – 4. Mai".
 */
export function formatWeekTitle(start: Date, end: Date): string {
  const { week } = getISOWeek(start);
  const last = addDays(start, 6);
  const sameMonth = start.getMonth() === last.getMonth();
  const sameYear = start.getFullYear() === last.getFullYear();
  if (sameMonth && sameYear) {
    const month = start.toLocaleDateString('de-DE', { month: 'long' });
    return `Woche ${week} · ${start.getDate()}.–${last.getDate()}. ${month}`;
  }
  const startFmt = start.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
  const endFmt = last.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
  return `Woche ${week} · ${startFmt} – ${endFmt}`;
}
