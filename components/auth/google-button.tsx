'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

// Maps Google OAuth + our own error codes to short human messages.
// Unknown codes fall through to a generic line so we never expose raw
// machine identifiers to the visitor.
const ERROR_COPY: Record<string, string> = {
  access_denied: 'Google-Anmeldung wurde abgebrochen.',
  not_configured: 'Google-Login ist gerade nicht eingerichtet.',
  no_db: 'Login ist gerade nicht erreichbar. Bitte später erneut versuchen.',
  rate_limited: 'Zu viele Versuche. Bitte einen Moment warten.',
  state_expired: 'Login-Anfrage ist abgelaufen. Bitte erneut starten.',
  invalid_state: 'Login-Anfrage konnte nicht zugeordnet werden.',
  missing_params: 'Antwort von Google war unvollständig.',
  token_exchange_failed: 'Login-Austausch mit Google fehlgeschlagen.',
  email_not_verified: 'Google hat diese E-Mail nicht als bestätigt markiert.',
};

function copyFor(code: string | null): string | null {
  if (!code) return null;
  return ERROR_COPY[code] ?? 'Google-Login fehlgeschlagen. Bitte erneut versuchen.';
}

export function GoogleErrorBanner() {
  const sp = useSearchParams();
  const msg = copyFor(sp.get('oauth_error'));
  if (!msg) return null;
  return (
    <div className="rounded-[8px] border border-[#ff8a8a]/30 bg-[#ff8a8a]/10 px-3 py-2 text-[12.5px] leading-[1.5] text-[#ffbdbd]">
      {msg}
    </div>
  );
}

export function GoogleButton({
  label = 'Mit Google fortfahren',
}: {
  label?: string;
}) {
  const sp = useSearchParams();
  const from = sp.get('from');
  const [pending, setPending] = useState(false);

  const href =
    '/api/auth/google/start' + (from ? `?from=${encodeURIComponent(from)}` : '');

  return (
    <a
      href={href}
      onClick={() => setPending(true)}
      aria-disabled={pending}
      className="flex items-center justify-center gap-2.5 rounded-[8px] border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-[13.5px] font-medium leading-none text-ink-50 transition-colors hover:border-white/[0.18] hover:bg-white/[0.06] aria-disabled:pointer-events-none aria-disabled:opacity-60"
    >
      <GoogleLogo />
      <span>{pending ? 'Verbinde …' : label}</span>
    </a>
  );
}

// Multi-color official Google "G" mark. Inline SVG so it stays crisp at
// any DPR and we don't pull in an asset for a single icon.
function GoogleLogo() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 18 18"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <path
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.72v2.26h2.9c1.7-1.57 2.69-3.88 2.69-6.62Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.9-2.26c-.81.54-1.84.86-3.06.86-2.35 0-4.35-1.59-5.06-3.72H.96v2.34A9 9 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.94 10.7A5.41 5.41 0 0 1 3.66 9c0-.59.1-1.16.28-1.7V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l2.98-2.34Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.96L3.94 7.3C4.65 5.17 6.65 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}
