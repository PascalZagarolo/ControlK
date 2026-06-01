// ─── Relative-deadline resolver (pure, deterministic, testable) ──────
//
// The model is instructed to resolve relative German deadlines ("bis
// Freitag", "morgen", "nächste Woche") against the mail's SEND date. This
// module is the deterministic safety net + the unit-testable core: it
// resolves the same phrases independently so (a) we can repair/validate
// the model's date, and (b) the "Frist korrekt relativ zum Sendedatum"
// requirement is provable in CI without a live model.
//
// All arithmetic is in UTC to keep tests timezone-stable. Returns a
// date-anchored ISO string (time copied from the send date) or null.

const WEEKDAYS: Record<string, number> = {
  // 0 = Sunday … 6 = Saturday (JS getUTCDay convention)
  sonntag: 0,
  montag: 1,
  dienstag: 2,
  mittwoch: 3,
  donnerstag: 4,
  freitag: 5,
  samstag: 6,
  sonnabend: 6,
};

const MONTHS: Record<string, number> = {
  januar: 0, jan: 0,
  februar: 1, feb: 1,
  märz: 2, maerz: 2, mrz: 2,
  april: 3, apr: 3,
  mai: 4,
  juni: 5, jun: 5,
  juli: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  oktober: 9, okt: 9,
  november: 10, nov: 10,
  dezember: 11, dez: 11,
};

export type ResolvedDeadline = { iso: string; basis: string };

function atDay(send: Date, addDays: number): string {
  const d = new Date(Date.UTC(
    send.getUTCFullYear(),
    send.getUTCMonth(),
    send.getUTCDate() + addDays,
    send.getUTCHours(),
    send.getUTCMinutes(),
    0,
    0
  ));
  return d.toISOString();
}

function setDate(send: Date, year: number, month: number, day: number): string {
  const d = new Date(Date.UTC(year, month, day, send.getUTCHours(), send.getUTCMinutes(), 0, 0));
  return d.toISOString();
}

/**
 * Resolve a German relative-deadline phrase against a send date.
 *
 * Supported (case-insensitive, anywhere in the phrase):
 *   heute · morgen · übermorgen
 *   in N Tagen / in N Wochen
 *   (bis) <Wochentag>  — next occurrence strictly after the send day
 *   nächste/kommende Woche  (+7d, same weekday)
 *   Ende der Woche / bis Freitag-style → coming Friday
 *   am/bis (zum) DD.MM. / DD.MM.YYYY  · DD. <Monatsname> (YYYY)
 *
 * Returns null when no recognisable deadline phrase is present — callers
 * then treat the commitment as having no due date.
 */
export function resolveRelativeDeadline(
  phrase: string | null | undefined,
  sendDateIso: string
): ResolvedDeadline | null {
  if (!phrase) return null;
  const send = new Date(sendDateIso);
  if (Number.isNaN(send.getTime())) return null;
  const p = phrase.toLowerCase().trim();
  if (!p) return null;

  // ── Explicit numeric date: DD.MM. or DD.MM.YYYY ──
  const dmy = p.match(/\b(\d{1,2})\.\s*(\d{1,2})\.(?:\s*(\d{2,4}))?/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]) - 1;
    let year = dmy[3] ? Number(dmy[3]) : send.getUTCFullYear();
    if (year < 100) year += 2000;
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      let iso = setDate(send, year, month, day);
      // No explicit year + the date already passed this year → next year.
      if (!dmy[3] && new Date(iso).getTime() < send.getTime()) {
        iso = setDate(send, year + 1, month, day);
      }
      return { iso, basis: phrase.trim() };
    }
  }

  // ── DD. <Monatsname> (YYYY) ──
  const dMonth = p.match(/\b(\d{1,2})\.?\s+([a-zäöü]+)(?:\s+(\d{4}))?/);
  if (dMonth && MONTHS[dMonth[2]] !== undefined) {
    const day = Number(dMonth[1]);
    const month = MONTHS[dMonth[2]];
    let year = dMonth[3] ? Number(dMonth[3]) : send.getUTCFullYear();
    if (day >= 1 && day <= 31) {
      let iso = setDate(send, year, month, day);
      if (!dMonth[3] && new Date(iso).getTime() < send.getTime()) {
        iso = setDate(send, year + 1, month, day);
      }
      return { iso, basis: phrase.trim() };
    }
  }

  // ── Fixed keywords ──
  // NB: avoid \b around these — JS \b is ASCII-only and mishandles the
  // umlaut in "übermorgen". Order matters: übermorgen before morgen.
  if (p.includes('übermorgen')) return { iso: atDay(send, 2), basis: phrase.trim() };
  if (p.includes('morgen')) return { iso: atDay(send, 1), basis: phrase.trim() };
  if (/(^|[^a-zäöü])heute([^a-zäöü]|$)/.test(p)) return { iso: atDay(send, 0), basis: phrase.trim() };

  // ── in N Tagen / Wochen ──
  const inDays = p.match(/\bin\s+(\d{1,3})\s+tag(?:e|en)?\b/);
  if (inDays) return { iso: atDay(send, Number(inDays[1])), basis: phrase.trim() };
  const inWeeks = p.match(/\bin\s+(\d{1,2})\s+woche(?:n)?\b/);
  if (inWeeks) return { iso: atDay(send, Number(inWeeks[1]) * 7), basis: phrase.trim() };

  // ── Ende der Woche → coming Friday ──
  if (/\bende der woche\b|\bwochenende\b/.test(p)) {
    const delta = (5 - send.getUTCDay() + 7) % 7 || 7; // next Friday (≥ +1)
    return { iso: atDay(send, delta), basis: phrase.trim() };
  }

  // ── nächste/kommende Woche → +7d (same weekday) ──
  if (/\b(nächste|naechste|kommende)\s+woche\b/.test(p)) {
    return { iso: atDay(send, 7), basis: phrase.trim() };
  }

  // ── Weekday name ("bis Freitag", "am Montag") ──
  for (const [name, target] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b${name}\\b`).test(p)) {
      const delta = ((target - send.getUTCDay() + 7) % 7) || 7; // strictly after today
      return { iso: atDay(send, delta), basis: phrase.trim() };
    }
  }

  // ── nächste Woche / bald / demnächst etc. → unresolvable, no date ──
  return null;
}
