'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn } from '@/lib/actions/auth';
import { ErrorBanner, FieldLabel, PrimaryButton, TextInput } from './auth-shell';
import { GoogleButton, GoogleErrorBanner } from './google-button';

export function SignInForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const from = sp.get('from') ?? '/';
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [needsTotp, setNeedsTotp] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const data = new FormData(e.currentTarget);
        start(async () => {
          const res = await signIn(data);
          if (!res.ok) {
            setError(res.error);
            if (res.needsTotp) setNeedsTotp(true);
          } else {
            router.push(from);
          }
        });
      }}
      className="flex flex-col gap-4"
    >
      {error && <ErrorBanner>{error}</ErrorBanner>}
      <GoogleErrorBanner />

      <GoogleButton />

      <div className="flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-white/[0.06]" />
        <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
          oder mit E-Mail
        </span>
        <div className="h-px flex-1 bg-white/[0.06]" />
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel>E-Mail</FieldLabel>
        <TextInput name="email" type="email" autoComplete="email" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <FieldLabel>Passwort</FieldLabel>
          <Link
            href="/forgot-password"
            className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300 transition-colors hover:text-ink-50"
          >
            Vergessen?
          </Link>
        </div>
        <TextInput name="password" type="password" autoComplete="current-password" required />
      </div>

      {needsTotp && (
        <div className="flex flex-col gap-1.5">
          <FieldLabel>2FA-Code</FieldLabel>
          <TextInput
            name="totp"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            placeholder="6-stelliger Code"
            required
            autoFocus
          />
        </div>
      )}

      <PrimaryButton pending={pending} type="submit">
        Anmelden
      </PrimaryButton>

      <div className="flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-white/[0.06]" />
        <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
          oder
        </span>
        <div className="h-px flex-1 bg-white/[0.06]" />
      </div>

      <Link
        href="/magic-link"
        className="block rounded-[8px] border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-center text-[13.5px] font-medium leading-none text-ink-50 transition-colors hover:border-white/[0.18] hover:bg-white/[0.06]"
      >
        Per E-Mail-Link anmelden
      </Link>

      <p className="mt-2 text-center text-[12.5px] text-ink-300">
        Noch kein Konto?{' '}
        <Link href="/sign-up" className="text-ink-50 hover:underline">
          Registrieren
        </Link>
      </p>
    </form>
  );
}
