// Plain constants + pure helpers — no DB, no fetch, no server-only.
// Lives in its own module so client components (the connect banner)
// can import scope strings without dragging the whole API client into
// the browser bundle.

export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
] as const;

const GOOGLE_CALENDAR_READ_SCOPES = new Set<string>([
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar',
]);

export function hasCalendarScope(scopes: string | null | undefined): boolean {
  if (!scopes) return false;
  return scopes.split(/\s+/).some((sc) => GOOGLE_CALENDAR_READ_SCOPES.has(sc));
}
