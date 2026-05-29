'use client';

import { useState, useTransition } from 'react';
import { resendVerificationEmail } from '@/lib/actions/auth';
import { toast } from '@/lib/stores/toast-store';

export function VerifyBanner({ email }: { email: string }) {
  const [pending, start] = useTransition();
  const [dismissed, setDismissed] = useState(false);
  // Session-local dismiss only — the next page load brings it back.
  // We don't persist because the prompt is intentionally low-noise
  // (small bar, not a modal) and we want the user to actually verify.
  if (dismissed) return null;

  const onResend = () => {
    if (pending) return;
    start(async () => {
      const res = await resendVerificationEmail();
      if (res.ok) toast(`Bestätigungs-Mail an ${email} geschickt`, 'success');
      else toast(res.error ?? 'Konnte nicht erneut senden', 'danger');
    });
  };

  return (
    <div className="pointer-events-auto flex w-full max-w-[640px] items-center gap-3 rounded-full border border-[#E8B86D]/25 bg-[rgba(232,184,109,0.10)] px-4 py-2 shadow-[0_8px_24px_rgba(0,0,0,.35)] backdrop-blur-xl backdrop-saturate-150">
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#E8B86D]"
      />
      <p className="min-w-0 flex-1 truncate text-[12.5px] leading-tight text-[#E5E5E7]">
        <span className="font-medium text-[#FAFAFA]">Bestätige deine E-Mail.</span>{' '}
        <span className="text-ink-300">
          Wir haben dir einen Link an {email} geschickt.
        </span>
      </p>
      <button
        type="button"
        onClick={onResend}
        disabled={pending}
        className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.06em] text-[#E8B86D] transition-opacity hover:text-[#F0C079] disabled:opacity-50"
      >
        {pending ? 'Sende …' : 'Erneut senden'}
      </button>
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
