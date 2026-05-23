'use client';

import { Suspense, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthShell, ErrorBanner, FieldLabel, PrimaryButton, TextInput } from '@/components/auth/auth-shell';
import { PasswordStrength } from '@/components/auth/password-strength';
import { resetPassword } from '@/lib/actions/auth';

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();
  const token = sp.get('token') ?? '';
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');

  if (!token) {
    return <ErrorBanner>Kein Token im Link. Fordere einen neuen Reset an.</ErrorBanner>;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        data.set('token', token);
        setError(null);
        start(async () => {
          const res = await resetPassword(data);
          if (!res.ok) setError(res.error);
          else router.push('/');
        });
      }}
      className="flex flex-col gap-4"
    >
      {error && <ErrorBanner>{error}</ErrorBanner>}
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Neues Passwort</FieldLabel>
        <TextInput
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordStrength password={password} />
      </div>
      <PrimaryButton pending={pending} type="submit">
        Passwort speichern
      </PrimaryButton>
    </form>
  );
}

export default function Page() {
  return (
    <AuthShell kicker="Passwort zurücksetzen" title="Neues Passwort wählen" subtitle="Alle aktiven Sitzungen werden danach abgemeldet.">
      <Suspense>
        <Inner />
      </Suspense>
    </AuthShell>
  );
}
