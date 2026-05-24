'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { joinWaitlist } from '@/lib/actions/waitlist';

type State =
  | { kind: 'idle' }
  | { kind: 'error'; message: string }
  | { kind: 'success'; state: 'pending' | 'already_pending' | 'already_confirmed'; email: string };

const PRIMARY = '#FAFAFA';
const SECONDARY = '#A1A1AA';
const MUTED = '#52525B';
const ACCENT = '#E8B86D';
const BORDER = '#1F1F23';
const DANGER = '#A45A5A';
const DANGER_FG = '#D88A8A';

export function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [pending, startTransition] = useTransition();

  const valid = email.length > 0 && consent && !pending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setState({ kind: 'idle' });
    startTransition(async () => {
      const res = await joinWaitlist({ email, consent, source: 'landing' });
      if (res.ok) {
        setState({ kind: 'success', state: res.state, email });
      } else {
        setState({ kind: 'error', message: res.error });
      }
    });
  }

  if (state.kind === 'success') {
    const heading =
      state.state === 'already_confirmed'
        ? 'Du warst schon dabei.'
        : 'Fast geschafft.';
    const body =
      state.state === 'already_confirmed'
        ? 'Keine doppelte Mail nötig — du bekommst eine Nachricht, sobald Early Access bereitsteht.'
        : state.state === 'already_pending'
        ? `Wir haben dir eine neue Bestätigungs-Mail an ${state.email} geschickt. Klick den Link darin, um die Anmeldung abzuschließen.`
        : `Wir haben dir eine Bestätigungs-Mail an ${state.email} geschickt. Klick den Link darin, um die Anmeldung abzuschließen.`;

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
            color: PRIMARY,
            letterSpacing: '-0.01em',
            marginBottom: 14,
          }}
        >
          {heading}
        </p>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.7,
            color: SECONDARY,
            margin: 0,
          }}
        >
          {body}
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
          borderBottom: `1px solid ${state.kind === 'error' ? DANGER : BORDER}`,
          paddingBottom: 4,
          transition: 'border-color 140ms ease-out',
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
            color: PRIMARY,
            fontSize: 15,
            fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
            letterSpacing: '-0.005em',
            padding: '12px 4px',
          }}
        />
        <button
          type="submit"
          disabled={!valid}
          style={{
            background: 'transparent',
            border: 'none',
            color: valid ? ACCENT : MUTED,
            cursor: valid ? 'pointer' : 'default',
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

      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          cursor: 'pointer',
          textAlign: 'left',
          color: SECONDARY,
          fontSize: 13,
          lineHeight: 1.6,
          padding: '2px 0',
        }}
      >
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => {
            setConsent(e.target.checked);
            if (state.kind === 'error') setState({ kind: 'idle' });
          }}
          disabled={pending}
          aria-label="Einwilligung zur Datenverarbeitung"
          style={{
            appearance: 'none',
            width: 14,
            height: 14,
            marginTop: 3,
            borderRadius: 3,
            border: `1px solid ${consent ? ACCENT : '#3F3F46'}`,
            background: consent ? ACCENT : 'transparent',
            flexShrink: 0,
            cursor: 'pointer',
            transition: 'background 140ms ease-out, border-color 140ms ease-out',
            position: 'relative',
          }}
          className="landing-consent-checkbox"
        />
        <span>
          Ich willige in die Verarbeitung meiner E-Mail-Adresse zur Information über Ctrl K ein.
          Widerruf jederzeit möglich. Mehr in der{' '}
          <Link href="/datenschutz" className="landing-consent-link">
            Datenschutzerklärung
          </Link>
          .
        </span>
      </label>

      <div style={{ minHeight: 18 }} aria-live="polite">
        {state.kind === 'error' && (
          <p style={{ color: DANGER_FG, fontSize: 13, lineHeight: 1.5, margin: 0 }}>
            {state.message}
          </p>
        )}
      </div>

      <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.6, textAlign: 'left', margin: 0 }}>
        Nur echte Updates — Early Access, Milestones, ein Heads-up vor Launch. Kein Newsletter, kein
        Tracking.
      </p>

      <style>{`
        .landing-consent-checkbox:checked::after {
          content: '';
          position: absolute;
          left: 3px;
          top: 0px;
          width: 4px;
          height: 8px;
          border: solid #0A0A0C;
          border-width: 0 1.5px 1.5px 0;
          transform: rotate(45deg);
        }
        .landing-consent-checkbox:focus-visible {
          outline: 1px solid ${ACCENT};
          outline-offset: 2px;
        }
        .landing-consent-link {
          color: ${SECONDARY};
          text-decoration: underline;
          text-decoration-color: ${BORDER};
          text-underline-offset: 2px;
          transition: text-decoration-color 140ms ease-out, color 140ms ease-out;
        }
        .landing-consent-link:hover {
          color: ${PRIMARY};
          text-decoration-color: ${ACCENT};
        }
      `}</style>
    </form>
  );
}
