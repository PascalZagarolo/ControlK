'use client';

/**
 * Interaktiver Beispiel-Workflow auf der Landingpage.
 *
 * Treibt sich aus DEMSELBEN Sequenz-Kern wie das echte Produkt
 * (lib/flows/sequence → resolveFlow) und nutzt die ECHTEN Status-Tokens
 * (lib/flows/status → FLOW_STATUS). Kein Backend, keine DB: ein lokaler
 * In-Memory-Flow, den der Besucher anklicken kann — erledigt man den aktiven
 * Schritt, wird der nächste automatisch „aktiv", spätere bleiben „wartet".
 * So sieht man live, was Ctrl+K mit „erst A, dann B, dann C" meint.
 *
 * Bewusst an die App-Optik gebunden (Sand/Gold nur für AKTIV, gedämpfte
 * Done/Waiting, durchgezogene/gestrichelte Kanten) statt eines toten
 * Screenshots — die Landingpage zeigt das reale Verhalten.
 */
import { useMemo, useState } from 'react';
import { Eyebrow, Section } from './primitives';
import { Reveal } from './reveal';
import { resolveFlow, type RawStep, type RawStepStatus } from '@/lib/flows/sequence';
import { FLOW_STATUS } from '@/lib/flows/status';

// The demo workflow — a believable client-facing sequence.
const INITIAL: { id: string; title: string }[] = [
  { id: 'a', title: 'Angebot an Müller GmbH schreiben' },
  { id: 'b', title: 'Angebot rausschicken' },
  { id: 'c', title: 'Nach 3 Tagen nachfassen' },
  { id: 'd', title: 'Vertrag aufsetzen' },
];

export function WedgeFlowDemo() {
  // Status per step; everything else (active/waiting) is derived by resolveFlow.
  const [status, setStatus] = useState<Record<string, RawStepStatus>>({
    a: 'offen',
    b: 'offen',
    c: 'offen',
    d: 'offen',
  });

  const resolved = useMemo(() => {
    const steps: RawStep[] = INITIAL.map((s, i) => ({
      id: s.id,
      title: s.title,
      status: status[s.id] ?? 'offen',
      stepOrder: i,
      dependsOn: i > 0 ? INITIAL[i - 1].id : null,
    }));
    return resolveFlow(steps);
  }, [status]);

  const toggle = (id: string) =>
    setStatus((prev) => ({
      ...prev,
      [id]: prev[id] === 'erledigt' ? 'offen' : 'erledigt',
    }));

  const reset = () =>
    setStatus({ a: 'offen', b: 'offen', c: 'offen', d: 'offen' });

  const allDone = resolved.complete && resolved.totalCount > 0;

  return (
    <Section id="beispiel-workflow">
      <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <Reveal>
          <Eyebrow>Probier&apos;s aus</Eyebrow>
          <h2 className="mt-4 font-display text-[30px] font-semibold leading-[1.12] tracking-[-0.02em] text-ink-50 sm:text-[40px]">
            Abläufe, die wissen, was als Nächstes dran ist.
          </h2>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-200 sm:text-[17px]">
            Ein Flow ist eine Kette von Schritten — kein Termin nötig, die
            Reihenfolge ist die Information. Hak den{' '}
            <span className="text-[#E8B86D]">aktiven</span> Schritt ab: Ctrl+K
            rückt automatisch den nächsten vor, der Rest{' '}
            <span className="text-ink-100">wartet</span>, bis er dran ist.
          </p>
          <p className="mt-4 font-mono text-[12px] text-ink-300">
            ↓ Live — klick die Schritte an.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="rounded-2xl border border-white/[0.08] bg-ink-700/50 p-5 shadow-panel">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="font-display text-[15px] font-medium text-ink-50">
                Neuer Auftrag — Müller GmbH
              </p>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-300">
                {resolved.doneCount}/{resolved.totalCount}
              </span>
            </div>

            <ol className="flex flex-col gap-2">
              {resolved.steps.map((step, i) => {
                const tok = FLOW_STATUS[step.state];
                const last = i === resolved.steps.length - 1;
                return (
                  <li key={step.id} className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => toggle(step.id)}
                      aria-label={`${step.title} — ${tok.label}`}
                      className="flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors duration-150"
                      style={{ borderColor: tok.border, background: tok.bg, opacity: tok.opacity }}
                    >
                      <span
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full font-mono text-[11px]"
                        style={{
                          background: `${tok.color}22`,
                          color: tok.color,
                          border: step.state === 'active' ? `1px solid ${tok.color}` : '1px solid transparent',
                        }}
                      >
                        {step.state === 'done' ? '✓' : step.position}
                      </span>
                      <span
                        className={`min-w-0 flex-1 truncate text-[13.5px] ${
                          step.state === 'done'
                            ? 'text-ink-300 line-through decoration-ink-300/40'
                            : 'text-ink-50'
                        }`}
                      >
                        {step.title}
                      </span>
                      <span
                        className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.3px]"
                        style={{ color: tok.color }}
                      >
                        {tok.label}
                      </span>
                    </button>

                    {/* Verbindungs-Pfeil zum nächsten Schritt — durchgezogen,
                        sobald dieser Schritt erledigt ist (Weg beschritten),
                        sonst gestrichelt-gedämpft. Exakt wie im Produkt. */}
                    {!last && (
                      <span
                        aria-hidden
                        className="ml-[15px] h-3 w-px"
                        style={{
                          background:
                            step.state === 'done'
                              ? 'linear-gradient(#6a6b6c,#6a6b6c)'
                              : 'repeating-linear-gradient(#434345 0 3px, transparent 3px 7px)',
                        }}
                      />
                    )}
                  </li>
                );
              })}
            </ol>

            <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-ink-900/40 px-3.5 py-3">
              {allDone ? (
                <p className="text-[12.5px] leading-relaxed text-ink-100">
                  <span className="text-[#5ee08a]">✓ Ablauf erledigt.</span>{' '}
                  Im echten Produkt taucht so ein Schritt automatisch im
                  Morgen-Plan auf, wenn er fällig wird.
                </p>
              ) : (
                <p className="text-[12.5px] leading-relaxed text-ink-100">
                  Jetzt dran:{' '}
                  <span className="font-medium text-[#E8B86D]">
                    {resolved.steps.find((s) => s.state === 'active')?.title}
                  </span>
                  . Die Schritte danach sind gedämpft — sie warten, bis ihr
                  Vorgänger erledigt ist.
                </p>
              )}
            </div>

            {(resolved.doneCount > 0) && (
              <button
                type="button"
                onClick={reset}
                className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-300 transition-colors hover:text-ink-100"
              >
                ↺ Zurücksetzen
              </button>
            )}
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
