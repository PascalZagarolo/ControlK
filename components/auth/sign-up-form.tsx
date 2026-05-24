'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signUp } from '@/lib/actions/auth';
import {
  ErrorBanner,
  FieldLabel,
  InfoBanner,
  PrimaryButton,
  TextInput,
} from './auth-shell';
import { PasswordStrength } from './password-strength';
import { GoogleButton, GoogleErrorBanner } from './google-button';

export function SignUpForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const data = new FormData(e.currentTarget);
        start(async () => {
          const res = await signUp(data);
          if (!res.ok) setError(res.error);
          else router.push('/');
        });
      }}
      className="flex flex-col gap-4"
    >
      {error && <ErrorBanner>{error}</ErrorBanner>}
      <GoogleErrorBanner />

      <GoogleButton label="Mit Google registrieren" />

      <div className="flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-white/[0.06]" />
        <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
          oder mit E-Mail
        </span>
        <div className="h-px flex-1 bg-white/[0.06]" />
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel>Name</FieldLabel>
        <TextInput
          name="name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel>E-Mail</FieldLabel>
        <TextInput
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel>Passwort</FieldLabel>
        <TextInput
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordStrength password={password} userInputs={[name, email]} />
      </div>

      <PrimaryButton pending={pending} type="submit">
        Konto erstellen
      </PrimaryButton>

      <InfoBanner>
        Mit der Registrierung akzeptierst du die AGB. Du bekommst eine Bestätigungs-Mail.
      </InfoBanner>

      <p className="mt-2 text-center text-[12.5px] text-ink-300">
        Schon ein Konto?{' '}
        <Link href="/sign-in" className="text-ink-50 hover:underline">
          Anmelden
        </Link>
      </p>
    </form>
  );
}
