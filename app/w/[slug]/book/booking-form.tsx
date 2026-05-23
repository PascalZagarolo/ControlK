'use client';

import { useState, useTransition } from 'react';
import { submitBookingRequest } from '@/lib/actions/bookings';

type State =
  | { kind: 'idle' }
  | { kind: 'error'; message: string }
  | { kind: 'success' };

export function BookingForm({ slug }: { slug: string }) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    preferredAt: '',
    message: '',
  });

  if (state.kind === 'success') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[14px] border border-[#5ee08a]/30 bg-[#5ee08a]/[0.05] px-6 py-10 text-center">
        <span className="text-[36px]">✓</span>
        <h2 className="text-[18px] font-medium text-ink-50">Danke — Anfrage ist raus.</h2>
        <p className="text-[13px] text-ink-300">
          Du bekommst eine Bestätigung per Email, sobald sich jemand um die Anfrage
          gekümmert hat.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setState({ kind: 'idle' });
        start(async () => {
          const res = await submitBookingRequest({
            workspaceSlug: slug,
            name: form.name,
            email: form.email,
            phone: form.phone || undefined,
            preferredAt: form.preferredAt || undefined,
            message: form.message,
          });
          if (res.ok) setState({ kind: 'success' });
          else setState({ kind: 'error', message: res.error });
        });
      }}
      className="flex flex-col gap-4 rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-5"
    >
      {state.kind === 'error' && (
        <div className="rounded-[8px] border border-[#ff8a8a]/30 bg-[#ff8a8a]/[0.05] px-3 py-2 text-[12.5px] text-[#ff8a8a]">
          {state.message}
        </div>
      )}

      <Field label="Name *">
        <Input
          required
          value={form.name}
          onChange={(v) => setForm({ ...form, name: v })}
          placeholder="Max Mustermann"
          autoComplete="name"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Email *">
          <Input
            required
            type="email"
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
            placeholder="max@firma.de"
            autoComplete="email"
          />
        </Field>
        <Field label="Telefon (optional)">
          <Input
            type="tel"
            value={form.phone}
            onChange={(v) => setForm({ ...form, phone: v })}
            placeholder="+49 …"
            autoComplete="tel"
          />
        </Field>
      </div>

      <Field label="Wunsch-Termin (optional)" hint="Datum + Uhrzeit, falls schon konkret">
        <Input
          type="datetime-local"
          value={form.preferredAt}
          onChange={(v) => setForm({ ...form, preferredAt: v })}
        />
      </Field>

      <Field label="Worum geht es? *">
        <Textarea
          required
          rows={4}
          value={form.message}
          onChange={(v) => setForm({ ...form, message: v })}
          placeholder="Z.B. „Bräuchte einen Transporter für Sa 14.6.–So 15.6. — 9 Sitze möglich?"
        />
      </Field>

      <div className="flex items-center justify-between gap-3 pt-2">
        <p className="text-[10.5px] leading-[1.5] text-ink-300">
          Mit Absenden erlaubst du dem Workspace-Owner, dich per Email/Telefon
          zurückzukontaktieren. Keine Weitergabe an Dritte.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-full bg-white px-4 py-2 text-[13px] font-medium leading-none text-black hover:bg-white/90 disabled:opacity-50"
        >
          {pending ? 'Sende …' : 'Anfrage senden'}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
        {label}
      </span>
      {children}
      {hint && <span className="text-[10.5px] text-ink-300">{hint}</span>}
    </label>
  );
}

function Input({
  value,
  onChange,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <input
      {...rest}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-[8px] border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[13.5px] text-ink-50 outline-none placeholder:text-ink-300 focus:border-white/[0.20] focus:bg-white/[0.04]"
    />
  );
}

function Textarea({
  value,
  onChange,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'>) {
  return (
    <textarea
      {...rest}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full resize-none rounded-[8px] border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[13.5px] text-ink-50 outline-none placeholder:text-ink-300 focus:border-white/[0.20] focus:bg-white/[0.04]"
    />
  );
}
