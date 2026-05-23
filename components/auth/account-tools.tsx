'use client';

import { useState, useTransition } from 'react';
import {
  ErrorBanner,
  FieldLabel,
  InfoBanner,
  PrimaryButton,
  TextInput,
} from './auth-shell';
import { deleteAccount, exportAccountData } from '@/lib/actions/account';

export function ExportTrigger() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const onClick = () => {
    setError(null);
    start(async () => {
      const res = await exportAccountData();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const blob = new Blob([res.json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  };
  return (
    <div className="flex flex-col gap-2">
      {error && <ErrorBanner>{error}</ErrorBanner>}
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="w-fit rounded-[8px] border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[13px] font-medium leading-none text-ink-50 transition-colors hover:border-white/[0.18] hover:bg-white/[0.06] disabled:opacity-40"
      >
        {pending ? 'Wird vorbereitet …' : 'Daten als JSON exportieren'}
      </button>
    </div>
  );
}

export function DeleteAccountForm() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  if (!confirmed) {
    return (
      <div className="flex flex-col gap-3">
        <InfoBanner>
          Wenn du dein Konto löschst, werden alle deine Daten unwiderruflich gelöscht — Workspaces,
          Nachrichten, Verträge, Notifications. Wir behalten nichts.
        </InfoBanner>
        <button
          type="button"
          onClick={() => setConfirmed(true)}
          className="w-fit rounded-[8px] border border-[#ff8a8a]/30 bg-[#ff8a8a]/10 px-4 py-2 text-[13px] font-medium leading-none text-[#ffbdbd] transition-colors hover:bg-[#ff8a8a]/15"
        >
          Konto löschen wollen
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const res = await deleteAccount(data);
          if (!res.ok) setError(res.error);
        });
      }}
      className="flex flex-col gap-3"
    >
      {error && <ErrorBanner>{error}</ErrorBanner>}
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Passwort</FieldLabel>
        <TextInput name="password" type="password" autoComplete="current-password" />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel>
          Zur Bestätigung tippe <span className="text-[#ffbdbd]">LÖSCHEN</span>
        </FieldLabel>
        <TextInput name="confirm" type="text" autoComplete="off" required />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[8px] border border-[#ff8a8a]/30 bg-[#ff8a8a]/10 px-4 py-2 text-[13px] font-medium leading-none text-[#ffbdbd] transition-colors hover:bg-[#ff8a8a]/15 disabled:opacity-40"
        >
          {pending ? 'Wird gelöscht …' : 'Endgültig löschen'}
        </button>
        <button
          type="button"
          onClick={() => setConfirmed(false)}
          className="rounded-[8px] border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[13px] font-medium leading-none text-ink-50 hover:border-white/[0.18] hover:bg-white/[0.06]"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
