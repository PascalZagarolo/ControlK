'use client';

import { useState, useTransition } from 'react';
import { confirmTotp, disableTotp, startTotpSetup } from '@/lib/actions/two-factor';
import {
  ErrorBanner,
  FieldLabel,
  InfoBanner,
  PrimaryButton,
  TextInput,
} from './auth-shell';

export function TwoFactorSetup({ enabled }: { enabled: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<{
    secret: string;
    qrDataUrl: string;
  } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [disabled, setDisabled] = useState(!enabled);

  const onStart = () => {
    setError(null);
    start(async () => {
      const res = await startTotpSetup();
      if (!res.ok) setError(res.error);
      else setSetup({ secret: res.secret, qrDataUrl: res.qrDataUrl });
    });
  };

  const onConfirm = (form: FormData) => {
    setError(null);
    const code = String(form.get('code') ?? '');
    start(async () => {
      const res = await confirmTotp(code);
      if (!res.ok) setError(res.error);
      else {
        setConfirmed(true);
        setDisabled(false);
      }
    });
  };

  const onDisable = (form: FormData) => {
    setError(null);
    start(async () => {
      const res = await disableTotp(form);
      if (!res.ok) setError(res.error);
      else {
        setDisabled(true);
        setSetup(null);
        setConfirmed(false);
      }
    });
  };

  if (!disabled && !setup && !confirmed) {
    return (
      <div className="flex flex-col gap-3">
        <InfoBanner>2FA ist aktiviert.</InfoBanner>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onDisable(new FormData(e.currentTarget));
          }}
          className="flex flex-col gap-3"
        >
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Passwort bestätigen</FieldLabel>
            <TextInput name="password" type="password" required autoComplete="current-password" />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-[8px] border border-[#ff8a8a]/30 bg-[#ff8a8a]/10 px-4 py-2.5 text-[13.5px] font-medium leading-none text-[#ffbdbd] transition-colors duration-150 hover:bg-[#ff8a8a]/15 disabled:opacity-40"
          >
            2FA deaktivieren
          </button>
        </form>
      </div>
    );
  }

  if (confirmed) {
    return <InfoBanner>2FA wurde erfolgreich aktiviert.</InfoBanner>;
  }

  if (setup) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(new FormData(e.currentTarget));
        }}
        className="flex flex-col gap-4"
      >
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <p className="text-[13px] leading-[1.55] text-ink-200">
          Scanne den QR-Code mit deiner Authenticator-App (1Password, Authy, Google Authenticator, …),
          oder gib den Secret-Key manuell ein:
        </p>
        <div className="flex items-start gap-4 rounded-[10px] border border-white/[0.06] bg-white/[0.02] p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qrDataUrl} alt="2FA QR Code" className="h-32 w-32 rounded-[6px]" />
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
              Secret
            </div>
            <code className="mt-1 block break-all font-mono text-[11.5px] text-ink-50">
              {setup.secret}
            </code>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>6-stelliger Code aus der App</FieldLabel>
          <TextInput
            name="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            required
            autoFocus
            placeholder="123456"
          />
        </div>
        <PrimaryButton pending={pending} type="submit">
          Aktivieren
        </PrimaryButton>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] leading-[1.55] text-ink-200">
        Erhöhe die Sicherheit deines Kontos. Du brauchst dann zusätzlich zum Passwort einen
        zeitbasierten 6-stelligen Code aus deiner Authenticator-App.
      </p>
      {error && <ErrorBanner>{error}</ErrorBanner>}
      <PrimaryButton pending={pending} type="button" onClick={onStart}>
        2FA einrichten
      </PrimaryButton>
    </div>
  );
}
