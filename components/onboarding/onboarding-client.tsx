'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  setOnboardingFocus,
  setWorkspaceType,
  completeOnboarding,
  runFirstScan,
  type OnboardingFocus,
} from '@/lib/actions/onboarding';
import { tagSenderAsClient } from '@/lib/actions/contact-tags';
import type {
  OnboardingScanResult,
  OnboardingScanSender,
} from '@/lib/actions/onboarding-types';
import { toast } from '@/lib/stores/toast-store';

// gmail.modify supersedes readonly — the same scope the Settings connect uses.
const GMAIL_MODIFY = 'https://www.googleapis.com/auth/gmail.modify';
const CONNECT_HREF =
  `/api/auth/google/start?scopes=${encodeURIComponent(GMAIL_MODIFY)}` +
  `&from=${encodeURIComponent('/onboarding?connected=1')}`;

type Step = 1 | 2 | 3;
type ScanPhase = 'connect' | 'scanning' | 'result';

const FOCUS_OPTIONS: { value: OnboardingFocus; label: string }[] = [
  { value: 'commitments', label: 'Ich verliere den Überblick, wem ich was versprochen habe' },
  { value: 'response_time', label: 'Kunden warten zu lange auf meine Antwort' },
  { value: 'morning_chaos', label: 'Mein Tag ist morgens ein Chaos' },
  { value: 'all', label: 'Ehrlich gesagt: alles davon' },
];

// Focus only personalises the step-3 framing — it never changes WHICH
// features a user gets. One product, one plan.
const FOCUS_INTRO: Record<OnboardingFocus, string> = {
  commitments:
    'Ich lese gleich deine letzten gesendeten Mails und sammle, was du jemandem versprochen hast.',
  response_time:
    'Ich schaue, wer auf eine Antwort von dir wartet — und wie lange schon.',
  morning_chaos:
    'Ich baue dir aus Mails, Zusagen und Terminen den einen Plan für deinen Tag.',
  all: 'Ich lese deine Mails, sammle deine offenen Zusagen und baue daraus deinen Tagesplan.',
};

export function OnboardingClient({
  userName,
  initialFocus,
  gmailConnected,
  justConnected,
}: {
  userName: string;
  initialFocus: OnboardingFocus | null;
  gmailConnected: boolean;
  justConnected: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // If the user just came back from the Google consent screen (or is already
  // connected from a prior attempt), they were on step 3 — resume there.
  const resumeAtConnect = justConnected || gmailConnected;
  const [step, setStep] = useState<Step>(resumeAtConnect ? 3 : 1);
  const [focus, setFocus] = useState<OnboardingFocus | null>(initialFocus);
  const [wsType, setWsType] = useState<'solo' | 'team' | null>(null);

  const [phase, setPhase] = useState<ScanPhase>(
    gmailConnected ? 'scanning' : 'connect'
  );
  const [scan, setScan] = useState<OnboardingScanResult | null>(null);
  const scanStarted = useRef(false);

  // ── Step 1: focus ──────────────────────────────────────────────────
  const chooseFocus = (value: OnboardingFocus) => {
    setFocus(value);
    startTransition(async () => {
      await setOnboardingFocus(value);
      setStep(2);
    });
  };

  // ── Step 2: solo / team ────────────────────────────────────────────
  const chooseType = (type: 'solo' | 'team') => {
    setWsType(type);
    startTransition(async () => {
      await setWorkspaceType(type);
      setStep(3);
    });
  };

  // ── Step 3: first scan ─────────────────────────────────────────────
  const doScan = useCallback(() => {
    if (scanStarted.current) return;
    scanStarted.current = true;
    setPhase('scanning');
    startTransition(async () => {
      const result = await runFirstScan();
      setScan(result);
      setPhase('result');
    });
    // startTransition isn't a dep — it's stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-run the scan the moment we land on step 3 with Gmail connected.
  useEffect(() => {
    if (step === 3 && gmailConnected && !scanStarted.current) {
      doScan();
    }
  }, [step, gmailConnected, doScan]);

  const finish = () => {
    startTransition(async () => {
      await completeOnboarding();
      router.replace('/');
      router.refresh();
    });
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#0A0A0C] text-[#F0F0F2]">
      {/* Same restrained light wash as the landing hero. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[380px] opacity-70"
        style={{
          background:
            'radial-gradient(54% 52% at 50% 0%, rgba(232,184,109,0.06) 0%, rgba(232,184,109,0) 64%)',
        }}
      />
      <div className="relative mx-auto flex min-h-full w-full max-w-xl flex-col px-6 py-14 sm:py-20">
        <ProgressHeader step={step} />

        <div className="mt-10 flex-1">
          {step === 1 && (
            <StepFocus
              selected={focus}
              onSelect={chooseFocus}
              onSkip={() => setStep(2)}
              pending={pending}
            />
          )}
          {step === 2 && (
            <StepWorkspaceType
              selected={wsType}
              onSelect={chooseType}
              onSkip={() => setStep(3)}
              pending={pending}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <StepConnectScan
              userName={userName}
              focus={focus}
              phase={phase}
              scan={scan}
              onScanAgain={() => {
                scanStarted.current = false;
                doScan();
              }}
              onFinish={finish}
              pending={pending}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Progress ────────────────────────────────────────────────────────

function ProgressHeader({ step }: { step: Step }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#7c7c83]">
          Ctrl+K einrichten
        </span>
        <span className="ml-auto font-mono text-[11px] tracking-[0.08em] text-[#7c7c83]">
          Schritt {step} von 3
        </span>
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className="h-[3px] flex-1 rounded-full transition-colors duration-500"
            style={{ background: n <= step ? '#E8B86D' : '#1b1c1e' }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Step 1 — Aufgabe spiegeln ───────────────────────────────────────

function StepFocus({
  selected,
  onSelect,
  onSkip,
  pending,
}: {
  selected: OnboardingFocus | null;
  onSelect: (v: OnboardingFocus) => void;
  onSkip: () => void;
  pending: boolean;
}) {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2.5">
        <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.01em] sm:text-[28px]">
          Was willst du mit Ctrl+K vor allem in den Griff bekommen?
        </h1>
        <p className="text-[14px] leading-relaxed text-[#9c9c9d]">
          Damit du dich gleich zu Hause fühlst — du bekommst trotzdem alles, das
          ist keine Einbahnstraße.
        </p>
      </header>

      <ul className="flex flex-col gap-2.5">
        {FOCUS_OPTIONS.map((opt) => {
          const active = selected === opt.value;
          return (
            <li key={opt.value}>
              <button
                type="button"
                disabled={pending}
                onClick={() => onSelect(opt.value)}
                className="group flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all duration-200 disabled:cursor-not-allowed"
                style={{
                  borderColor: active ? 'rgba(232,184,109,0.45)' : 'rgba(255,255,255,0.07)',
                  background: active ? 'rgba(232,184,109,0.06)' : 'rgba(255,255,255,0.015)',
                }}
              >
                <span
                  aria-hidden
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors"
                  style={{
                    borderColor: active ? '#E8B86D' : '#434345',
                    background: active ? '#E8B86D' : 'transparent',
                  }}
                >
                  {active && (
                    <span className="h-2 w-2 rounded-full bg-[#0A0A0C]" />
                  )}
                </span>
                <span className="text-[14.5px] font-medium leading-snug text-[#F0F0F2]">
                  {opt.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={onSkip}
        disabled={pending}
        className="self-start text-[12.5px] text-[#7c7c83] transition-colors hover:text-[#9c9c9d] disabled:opacity-50"
      >
        Überspringen →
      </button>
    </section>
  );
}

// ─── Step 2 — Solo oder Team ─────────────────────────────────────────

function StepWorkspaceType({
  selected,
  onSelect,
  onSkip,
  pending,
  onBack,
}: {
  selected: 'solo' | 'team' | null;
  onSelect: (t: 'solo' | 'team') => void;
  onSkip: () => void;
  pending: boolean;
  onBack: () => void;
}) {
  const options: {
    value: 'solo' | 'team';
    title: string;
    body: string;
  }[] = [
    {
      value: 'solo',
      title: 'Solo',
      body: 'Nur ich. Meine Mails, meine Zusagen, mein Tag.',
    },
    {
      value: 'team',
      title: 'Team',
      body: 'Wir arbeiten zu mehreren — geteilte Kunden und Übergaben.',
    },
  ];
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2.5">
        <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.01em] sm:text-[28px]">
          Arbeitest du solo oder im Team?
        </h1>
        <p className="text-[14px] leading-relaxed text-[#9c9c9d]">
          Das Einzige, was wirklich etwas verändert — daran richtet sich aus, was
          geteilt wird und was nur dir gehört.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {options.map((opt) => {
          const active = selected === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={pending}
              onClick={() => onSelect(opt.value)}
              className="flex flex-col gap-1.5 rounded-2xl border px-4 py-4 text-left transition-all duration-200 disabled:cursor-not-allowed"
              style={{
                borderColor: active ? 'rgba(232,184,109,0.45)' : 'rgba(255,255,255,0.07)',
                background: active ? 'rgba(232,184,109,0.06)' : 'rgba(255,255,255,0.015)',
              }}
            >
              <span className="text-[15px] font-semibold text-[#F0F0F2]">
                {opt.title}
              </span>
              <span className="text-[13px] leading-relaxed text-[#9c9c9d]">
                {opt.body}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-5">
        <button
          type="button"
          onClick={onBack}
          disabled={pending}
          className="text-[12.5px] text-[#7c7c83] transition-colors hover:text-[#9c9c9d] disabled:opacity-50"
        >
          ← Zurück
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={pending}
          className="text-[12.5px] text-[#7c7c83] transition-colors hover:text-[#9c9c9d] disabled:opacity-50"
        >
          Überspringen →
        </button>
      </div>
    </section>
  );
}

// ─── Step 3 — Connect + Scan ─────────────────────────────────────────

function StepConnectScan({
  userName,
  focus,
  phase,
  scan,
  onScanAgain,
  onFinish,
  pending,
}: {
  userName: string;
  focus: OnboardingFocus | null;
  phase: ScanPhase;
  scan: OnboardingScanResult | null;
  onScanAgain: () => void;
  onFinish: () => void;
  pending: boolean;
}) {
  if (phase === 'connect') {
    return <ConnectPrompt focus={focus} onFinish={onFinish} pending={pending} />;
  }
  if (phase === 'scanning') {
    return <Scanning focus={focus} />;
  }
  // result
  if (!scan || !scan.ok) {
    return <ScanFailed reason={scan?.reason} onScanAgain={onScanAgain} onFinish={onFinish} pending={pending} />;
  }
  return (
    <ScanResult userName={userName} scan={scan} onFinish={onFinish} pending={pending} />
  );
}

function ConnectPrompt({
  focus,
  onFinish,
  pending,
}: {
  focus: OnboardingFocus | null;
  onFinish: () => void;
  pending: boolean;
}) {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2.5">
        <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.01em] sm:text-[28px]">
          Verbinde Gmail — dann zeig ich dir sofort etwas Echtes.
        </h1>
        <p className="text-[14px] leading-relaxed text-[#9c9c9d]">
          {FOCUS_INTRO[focus ?? 'all']} Daraus baue ich deinen ersten Morgen-Plan
          — mit deinen echten Daten, nicht mit Beispielen.
        </p>
      </header>

      {/* Honest trust note — exactly what's read, and what is NOT done. */}
      <div className="flex flex-col gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
        <TrustRow tone="ok" text="Liest deinen Posteingang (Triage) und deine gesendeten Mails (Zusagen)." />
        <TrustRow tone="off" text="Versendet, löscht oder archiviert nichts ohne deine Bestätigung." />
        <TrustRow tone="off" text="Gibt nichts weiter — deine Mails bleiben deine." />
      </div>

      <a
        href={CONNECT_HREF}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E8B86D] px-5 py-3 text-[14px] font-semibold leading-none text-[#0A0A0C] transition-colors hover:bg-[#F0C079]"
      >
        <GoogleMark />
        Gmail verbinden
      </a>

      <button
        type="button"
        onClick={onFinish}
        disabled={pending}
        className="self-start text-[12.5px] text-[#7c7c83] transition-colors hover:text-[#9c9c9d] disabled:opacity-50"
      >
        Erstmal überspringen — der Plan füllt sich, sobald du verbindest.
      </button>
    </section>
  );
}

function Scanning({ focus }: { focus: OnboardingFocus | null }) {
  const lines = [
    'Ich schaue deine letzten gesendeten Mails durch …',
    'Ich sammle, was du jemandem versprochen hast …',
    'Ich sortiere deinen Posteingang nach dem, was wartet …',
    'Ich baue daraus deinen Morgen-Plan …',
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1 < lines.length ? i + 1 : i));
    }, 1400);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <section className="flex flex-col gap-6 pt-4">
      <div className="flex items-center gap-3">
        <Spinner />
        <p className="text-[15px] font-medium text-[#F0F0F2]">
          {FOCUS_INTRO[focus ?? 'all'].split('—')[0].trim()}
        </p>
      </div>
      <ul className="flex flex-col gap-2.5 pl-0.5">
        {lines.map((line, i) => (
          <li
            key={line}
            className="flex items-center gap-2.5 text-[13.5px] transition-colors duration-500"
            style={{ color: i <= idx ? '#9c9c9d' : '#52525B' }}
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full transition-colors duration-500"
              style={{ background: i < idx ? '#5ee08a' : i === idx ? '#E8B86D' : '#434345' }}
            />
            {line}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ScanResult({
  userName,
  scan,
  onFinish,
  pending,
}: {
  userName: string;
  scan: Extract<OnboardingScanResult, { ok: true }>;
  onFinish: () => void;
  pending: boolean;
}) {
  const { plan, scan: counts, senders } = scan;
  const empty = plan.items.length === 0 || plan.isCalm;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.01em] sm:text-[28px]">
          {empty ? `Sieht ruhig aus, ${userName}.` : `Das hier wartet, ${userName}.`}
        </h1>
        <p className="text-[14px] leading-relaxed text-[#9c9c9d]">
          {plan.summaryLine}
        </p>
        {/* Honest scan provenance — never hide what was (not) found. */}
        <p className="font-mono text-[11px] tracking-[0.04em] text-[#7c7c83]">
          {counts.mailsRead} Mails gelesen · {counts.commitmentsFound}{' '}
          {counts.commitmentsFound === 1 ? 'Zusage' : 'Zusagen'} erkannt
        </p>
      </header>

      {empty ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
          <p className="text-[13.5px] leading-relaxed text-[#9c9c9d]">
            Ich habe nichts gefunden, das heute dringend deine Aufmerksamkeit
            braucht — keine überfälligen Zusagen, niemand wartet zu lange. Das ist
            ein gutes Zeichen, kein leerer Bildschirm. Sobald sich etwas ändert,
            steht es morgens hier.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {plan.items.map((item) => (
            <li
              key={item.key}
              className="flex items-stretch overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]"
            >
              <span aria-hidden className="w-[3px] shrink-0" style={{ background: item.accent }} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className="font-mono text-[9.5px] uppercase tracking-[0.3px]"
                    style={{ color: item.accent }}
                  >
                    {item.kicker}
                  </span>
                  {item.timing && (
                    <span className="font-mono text-[10px] text-[#7c7c83]">· {item.timing}</span>
                  )}
                </div>
                <p className="truncate text-[14px] font-medium text-[#F0F0F2]">
                  {item.isQuestion ? `${item.title}?` : item.title}
                </p>
                <p className="truncate text-[12px] text-[#9b9ba0]">{item.reason}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {plan.collision && (
        <div className="flex items-start gap-2.5 rounded-xl border border-[#E8B86D]/20 bg-[#E8B86D]/[0.06] p-3">
          <span aria-hidden className="mt-px text-[12px] text-[#E8B86D]">⚠</span>
          <p className="text-[12.5px] leading-relaxed text-[#9c9c9d]">{plan.collision}</p>
        </div>
      )}

      {senders.length > 0 && <SenderTagging senders={senders} />}

      <button
        type="button"
        onClick={onFinish}
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-[#E8B86D] px-5 py-3 text-[14px] font-semibold leading-none text-[#0A0A0C] transition-colors hover:bg-[#F0C079] disabled:opacity-60"
      >
        {pending ? 'Einen Moment …' : 'Zu meinem Morgen-Plan →'}
      </button>
    </section>
  );
}

function SenderTagging({ senders }: { senders: OnboardingScanSender[] }) {
  const [tagged, setTagged] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const tag = (s: OnboardingScanSender) => {
    setBusy(s.email);
    startTagging(s)
      .then((ok) => {
        if (ok) {
          setTagged((t) => ({ ...t, [s.email]: true }));
        } else {
          toast('Konnte nicht als Kunde markieren.', 'danger');
        }
      })
      .finally(() => setBusy(null));
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
      <p className="text-[13px] leading-relaxed text-[#9c9c9d]">
        Sind das Kunden? Markier sie kurz — dann hebt Ctrl+K ihre Nachrichten
        künftig hervor. (Optional, kannst du später ändern.)
      </p>
      <ul className="flex flex-col gap-1.5">
        {senders.map((s) => {
          const done = tagged[s.email];
          return (
            <li
              key={s.email}
              className="flex items-center gap-3 rounded-lg border border-white/[0.05] bg-black/20 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-[#F0F0F2]">{s.name}</p>
                <p className="truncate font-mono text-[11px] text-[#7c7c83]">{s.email}</p>
              </div>
              <button
                type="button"
                disabled={done || busy === s.email}
                onClick={() => tag(s)}
                className="shrink-0 rounded-md px-2.5 py-1.5 text-[12px] font-medium leading-none transition-colors disabled:cursor-default"
                style={
                  done
                    ? { background: 'rgba(94,224,138,0.10)', color: '#5ee08a' }
                    : { background: 'rgba(255,255,255,0.05)', color: '#F0F0F2' }
                }
              >
                {done ? '✓ Kunde' : busy === s.email ? '…' : 'Als Kunde'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

async function startTagging(s: OnboardingScanSender): Promise<boolean> {
  try {
    const r = await tagSenderAsClient({ email: s.email, scope: 'email', displayName: s.name });
    return r.ok;
  } catch {
    return false;
  }
}

function ScanFailed({
  reason,
  onScanAgain,
  onFinish,
  pending,
}: {
  reason?: 'not_connected' | 'no_scope' | 'auth' | 'error';
  onScanAgain: () => void;
  onFinish: () => void;
  pending: boolean;
}) {
  const needsConnect = reason === 'not_connected' || reason === 'no_scope' || reason === 'auth';
  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.01em]">
          Da ging etwas schief beim ersten Scan.
        </h1>
        <p className="text-[14px] leading-relaxed text-[#9c9c9d]">
          {needsConnect
            ? 'Die Gmail-Verbindung ist noch nicht vollständig. Verbinde sie noch einmal — dann läuft der Scan automatisch.'
            : 'Ich konnte gerade nicht alle Mails lesen. Das liegt nicht an dir — versuch es gleich noch einmal.'}
        </p>
      </header>
      <div className="flex flex-wrap items-center gap-3">
        {needsConnect ? (
          <a
            href={CONNECT_HREF}
            className="inline-flex items-center gap-2 rounded-xl bg-[#E8B86D] px-5 py-3 text-[14px] font-semibold leading-none text-[#0A0A0C] transition-colors hover:bg-[#F0C079]"
          >
            <GoogleMark />
            Gmail verbinden
          </a>
        ) : (
          <button
            type="button"
            onClick={onScanAgain}
            className="inline-flex items-center gap-2 rounded-xl bg-[#E8B86D] px-5 py-3 text-[14px] font-semibold leading-none text-[#0A0A0C] transition-colors hover:bg-[#F0C079]"
          >
            Nochmal scannen
          </button>
        )}
        <button
          type="button"
          onClick={onFinish}
          disabled={pending}
          className="text-[12.5px] text-[#7c7c83] transition-colors hover:text-[#9c9c9d] disabled:opacity-50"
        >
          Später — ich will erstmal rein.
        </button>
      </div>
    </section>
  );
}

// ─── Small bits ──────────────────────────────────────────────────────

function TrustRow({ tone, text }: { tone: 'ok' | 'off'; text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        aria-hidden
        className="mt-[3px] text-[11px]"
        style={{ color: tone === 'ok' ? '#5ee08a' : '#7c7c83' }}
      >
        {tone === 'ok' ? '✓' : '—'}
      </span>
      <p className="text-[12.5px] leading-relaxed text-[#9c9c9d]">{text}</p>
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#434345] border-t-[#E8B86D]"
    />
  );
}

function GoogleMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#0A0A0C"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#0A0A0C"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
        opacity=".75"
      />
      <path
        fill="#0A0A0C"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
        opacity=".5"
      />
      <path
        fill="#0A0A0C"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
        opacity=".9"
      />
    </svg>
  );
}
