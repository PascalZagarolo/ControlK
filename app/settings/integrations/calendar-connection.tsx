import Link from 'next/link';
import { hasCalendarScope } from '@/lib/google/calendar-scopes';
import { connectCalendarHref } from '@/lib/actions/google-calendar';
import type { GoogleConnection } from '@/lib/auth/google-tokens';

/**
 * "Google Calendar" panel for /settings/integrations. This is the ONLY place
 * the calendar-connect prompt lives now (the old app-wide floating banner was
 * removed — it nagged once Gmail was on). States:
 *   1. No Google connection at all → guide the user to connect Gmail first.
 *   2. Google connected, no calendar scope → show "Kalender verbinden" CTA.
 *   3. Calendar scope granted → confirm connected, no further prompt.
 */
export function CalendarConnection({
  connection,
}: {
  connection: GoogleConnection | null;
}) {
  const connectedGoogle = !!connection?.hasOfflineAccess;
  // GoogleConnection.scopes is already a string[]; hasCalendarScope expects a
  // space-joined string (matches the raw oauth scopes column shape).
  const calendarOn = !!connection && hasCalendarScope((connection.scopes ?? []).join(' '));

  return (
    <section className="flex flex-col gap-3 rounded-[12px] border border-white/[0.08] bg-white/[0.02] p-5">
      <header className="flex items-start gap-3">
        <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center text-[15px] leading-none">📅</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-medium leading-tight text-ink-50">Google Calendar</h2>
          <p className="mt-0.5 text-[12.5px] leading-[1.55] text-ink-300">
            Termine aus deinem Google-Kalender erscheinen direkt in Ctrl K. Nur
            Lese-Zugriff, Tokens verschlüsselt gespeichert.
          </p>
        </div>
        <StatusBadge connectedGoogle={connectedGoogle} calendarOn={calendarOn} />
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {calendarOn ? (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-[#5ee08a]/[0.10] px-3 py-1.5 text-[11.5px] font-medium leading-none text-[#5ee08a]">
            <span aria-hidden>✓</span>
            <span>Kalender verbunden</span>
          </span>
        ) : connectedGoogle ? (
          <Link
            href={connectCalendarHref('/settings/integrations')}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#E8B86D] px-3.5 py-2 text-[13px] font-medium leading-none text-[#0A0A0C] transition-colors hover:bg-[#F0C079]"
          >
            Kalender verbinden
          </Link>
        ) : (
          <p className="text-[12.5px] leading-[1.55] text-ink-300">
            Verbinde zuerst oben dein Google-Konto — danach kannst du den
            Kalender-Zugriff hier mit einem Klick ergänzen.
          </p>
        )}
      </div>
    </section>
  );
}

function StatusBadge({ connectedGoogle, calendarOn }: { connectedGoogle: boolean; calendarOn: boolean }) {
  if (calendarOn) {
    return (
      <span className="shrink-0 rounded-full border border-[#5ee08a]/30 bg-[#5ee08a]/[0.08] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[#5ee08a]">
        Aktiv
      </span>
    );
  }
  if (connectedGoogle) {
    return (
      <span className="shrink-0 rounded-full border border-[#ffd96a]/30 bg-[#ffd96a]/[0.06] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[#ffd96a]">
        Nicht verbunden
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-300">
      Kein Google
    </span>
  );
}
