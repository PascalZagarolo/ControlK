'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { AuthShell, ErrorBanner, FieldLabel, InfoBanner, PrimaryButton, TextInput } from '@/components/auth/auth-shell';
import { requestPasswordReset } from '@/lib/actions/auth';

export default function Page() {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <AuthShell
      kicker="Passwort vergessen"
      title="Reset-Link anfordern"
      subtitle="Gib deine E-Mail ein. Wenn ein Konto existiert, schicken wir dir einen Link."
    >
      {sent ? (
        <InfoBanner>
          Wenn die E-Mail bei uns registriert ist, ist der Reset-Link unterwegs. Schau auch im
          Spam-Ordner nach.
        </InfoBanner>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            setError(null);
            start(async () => {
              const res = await requestPasswordReset(data);
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
            Reset-Link senden
          </PrimaryButton>
        </form>
      )}
      <p className="mt-4 text-center text-[12.5px] text-ink-300">
        <Link href="/sign-in" className="text-ink-50 hover:underline">
          Zurück zur Anmeldung
        </Link>
      </p>
    </AuthShell>
  );
}
