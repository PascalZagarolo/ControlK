import { GOOGLE_CALENDAR_SCOPES } from '@/lib/google/calendar-scopes';

/**
 * Build the URL that kicks off a Google OAuth re-consent flow with
 * calendar scopes layered on top of whatever the user already granted.
 *
 * No server-action needed — the route at /api/auth/google/start does
 * all the heavy lifting (state insert, PKCE, scope-whitelist check).
 * Use as `<Link href={connectCalendarHref('/')}>`.
 */
export function connectCalendarHref(returnTo: string = '/'): string {
  const params = new URLSearchParams({
    scopes: GOOGLE_CALENDAR_SCOPES.join(' '),
    from: returnTo,
  });
  return `/api/auth/google/start?${params.toString()}`;
}
