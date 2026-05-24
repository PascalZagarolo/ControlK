/**
 * Parses the inline "quick syntax" from the todo input box.
 *
 * Supported:
 *   - Trailing keyword "heute" / "morgen" / "übermorgen" → due date
 *   - Trailing weekday "Mo/Di/Mi/Do/Fr/Sa/So" (next occurrence) → due date
 *   - Inline `#tag` tokens → array of tag slugs
 *
 * Deliberately NOT in V1:
 *   - Times of day ("um 14 Uhr")
 *   - Relative offsets ("in 3 Tagen")
 *   - @mentions / @assignee
 *   - !high priority
 *
 * Returns the cleaned title (with all parsed tokens removed) plus the
 * extracted dueAt + tags. The caller decides what to do with them.
 *
 * Conservative: only the LAST date-keyword counts. Multiple #tags allowed
 * anywhere in the string. The cleaned title preserves order of non-token
 * words.
 */

export type ParsedTodoInput = {
  title: string;
  dueAt: Date | null;
  tags: string[];
};

const DATE_KEYWORDS: Record<string, () => Date> = {
  heute: () => atNoonToday(0),
  morgen: () => atNoonToday(1),
  übermorgen: () => atNoonToday(2),
  uebermorgen: () => atNoonToday(2),
};

const WEEKDAY_KEYWORDS: Record<string, number> = {
  mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6, so: 0,
  mon: 1, die: 2, mit: 3, don: 4, fre: 5, sam: 6, son: 0,
  montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6, sonntag: 0,
};

function atNoonToday(offsetDays: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d;
}

function nextWeekday(target: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const current = d.getDay();
  let delta = target - current;
  if (delta <= 0) delta += 7; // always future
  d.setDate(d.getDate() + delta);
  return d;
}

export function parseTodoInput(raw: string): ParsedTodoInput {
  const text = raw.trim();
  if (!text) return { title: '', dueAt: null, tags: [] };

  // 1. Extract #tags (anywhere). Keep the rest.
  const tagRe = /#([a-z0-9_-]{1,32})/gi;
  const tags = Array.from(text.matchAll(tagRe)).map((m) => m[1].toLowerCase());
  let cleaned = text.replace(tagRe, '').replace(/\s+/g, ' ').trim();

  // 2. Trailing date-keyword
  let dueAt: Date | null = null;
  const tokens = cleaned.split(/\s+/);
  while (tokens.length > 0) {
    const last = tokens[tokens.length - 1].toLowerCase().replace(/[.,;:]+$/g, '');
    if (DATE_KEYWORDS[last]) {
      dueAt = DATE_KEYWORDS[last]();
      tokens.pop();
      continue;
    }
    if (WEEKDAY_KEYWORDS[last] !== undefined) {
      dueAt = nextWeekday(WEEKDAY_KEYWORDS[last]);
      tokens.pop();
      continue;
    }
    break;
  }
  cleaned = tokens.join(' ').trim();

  return { title: cleaned, dueAt, tags };
}
