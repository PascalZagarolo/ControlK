'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { AuthShell, ErrorBanner, FieldLabel, InfoBanner, PrimaryButton, TextInput } from '@/components/auth/auth-shell';
import { requestMagicLink } from '@/lib/actions/auth';

export default function Page() {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <AuthShell
      kicker="Magic Link"
      title="Per E-Mail anmelden"
      subtitle="Wir senden dir einen Login-Link. 15 Minuten gültig."
    >
      {sent ? (
        <InfoBanner>Link versandt. Schau in dein Postfach.</InfoBanner>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            setError(null);
            start(async () => {
              const res = await requestMagicLink(data);
              if (!res.ok) setError(res.error);
              else setSent(true);
            });
          }}
          className="flex flex-col gap-4"
        >
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <div className="flex flex-col gap-1.5">
            <FieldLabel>E-Mail</FieldLabel>
            <TextInput name="email" type="email" required autoComplete="email" autoFocus />
          </div>
          <PrimaryButton pending={pending} type="submit">
            Login-Link senden
          </PrimaryButton>
        </form>
      )}
      <p className="mt-4 text-center text-[12.5px] text-ink-300">
        Lieber{' '}
        <Link href="/sign-in" className="text-ink-50 hover:underline">
          Passwort
        </Link>
        ?
      </p>
    </AuthShell>
  );
}
