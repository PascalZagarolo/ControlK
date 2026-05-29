'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { connectCalendarHref } from '@/lib/actions/google-calendar';

/**
 * Banner shown when the signed-in user has Gmail connected but hasn't
 * granted Calendar scopes yet. Rendered on the foyer (and any other
 * page that mounts it via the root layout) until they consent.
 *
 * Dismissible per-session only — re-appears on next load if still
 * unconnected. We don't want this to nag, but we also can't let the
 * user permanently silence the prompt and then wonder why the
 * calendar view is empty.
 */
export function CalendarConnectBanner() {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="pointer-events-auto flex w-full max-w-[640px] items-center gap-3 rounded-full border border-[#5E9EFF]/25 bg-[rgba(94,158,255,0.10)] px-4 py-2 shadow-[0_8px_24px_rgba(0,0,0,.35)] backdrop-blur-xl backdrop-saturate-150">
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#5E9EFF]"
      />
      <p className="min-w-0 flex-1 truncate text-[12.5px] leading-tight text-[#E5E5E7]">
        <span className="font-medium text-[#FAFAFA]">Google Calendar verbinden.</span>{' '}
        <span className="text-ink-300">
          Termine aus deinem Google-Kalender erscheinen direkt in Ctrl K.
        </span>
      </p>
      <Link
        href={connectCalendarHref(pathname ?? '/')}
        className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.06em] text-[#5E9EFF] transition-opacity hover:text-[#7CB0FF]"
      >
        Verbinden
      </Link>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Banner schließen"
        className="shrink-0 text-ink-300 transition-colors hover:text-ink-50"
      >
        <span aria-hidden className="text-[14px] leading-none">×</span>
      </button>
    </div>
  );
}
