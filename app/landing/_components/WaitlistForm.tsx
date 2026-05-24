'use client';

import { useState, useTransition } from 'react';
import { joinWaitlist } from '@/lib/actions/waitlist';

type State =
  | { kind: 'idle' }
  | { kind: 'error'; message: string }
  | { kind: 'success'; alreadyOnList: boolean };

export function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setState({ kind: 'idle' });
    startTransition(async () => {
      const res = await joinWaitlist({ email, source: 'landing' });
      if (res.ok) {
        setState({ kind: 'success', alreadyOnList: res.alreadyOnList });
      } else {
        setState({ kind: 'error', message: res.error });
      }
    });
  }

  if (state.kind === 'success') {
    return (
      <div
        style={{
          maxWidth: 480,
          margin: '0 auto',
          textAlign: 'center',
          padding: '32px 24px',
        }}
      >
        <p
          style={{
            fontSize: 18,
            fontWeight: 500,
            color: '#FAFAFA',
            letterSpacing: '-0.01em',
            marginBottom: 14,
          }}
        >
          {state.alreadyOnList ? 'Du warst schon dabei.' : 'Du bist auf der Liste.'}
        </p>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.7,
            color: '#A1A1AA',
          }}
        >
          {state.alreadyOnList
            ? 'Keine doppelte Mail nötig — du bekommst eine Nachricht, sobald Early Access bereitsteht.'
            : 'Du bekommst eine Nachricht, sobald Early Access bereitsteht. Keine Newsletter, kein Tracking.'}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      style={{
        maxWidth: 480,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
      noValidate
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 10,
          borderBottom: '1px solid #1F1F23',
          paddingBottom: 4,
          transition: 'border-color 140ms ease-out',
          borderBottomColor: state.kind === 'error' ? '#A45A5A' : undefined,
        }}
      >
        <input
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state.kind === 'error') setState({ kind: 'idle' });
          }}
          disabled={pending}
          aria-label="E-Mail-Adresse"
          aria-invalid={state.kind === 'error'}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#FAFAFA',
            fontSize: 15,
            fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
            letterSpacing: '-0.005em',
            padding: '12px 4px',
          }}
        />
        <button
          type="submit"
          disabled={pending || !email}
          style={{
            background: 'transparent',
            border: 'none',
            color: pending || !email ? '#52525B' : '#E8B86D',
            cursor: pending || !email ? 'default' : 'pointer',
            fontSize: 15,
            padding: '12px 8px',
            transition: 'color 140ms ease-out, opacity 140ms ease-out',
            opacity: pending ? 0.6 : 1,
            letterSpacing: '-0.01em',
          }}
        >
          {pending ? 'Sende …' : 'Join →'}
        </button>
      </div>

      <div style={{ minHeight: 18 }} aria-live="polite">
        {state.kind === 'error' && (
          <p style={{ color: '#D88A8A', fontSize: 13, lineHeight: 1.5 }}>{state.message}</p>
        )}
      </div>

      <p style={{ color: '#52525B', fontSize: 13, lineHeight: 1.6, textAlign: 'left' }}>
        Nur echte Updates — Early Access, Milestones, ein Heads-up vor Launch. Kein Newsletter, kein
        Tracking.
      </p>
    </form>
  );
}
