'use client';

/**
 * SCHRITT 0 — interactive validation harness for commitment extraction.
 * Runs the real production extractor over your own recent sent mail (no DB
 * writes), shows each candidate with its source quote + confidence, and lets
 * you mark it echt/falsch to compute precision live. The number you get here
 * decides whether the wedge is real.
 */
import { useMemo, useState, useTransition } from 'react';
import { dryRunCommitmentScan, type DryRunReport } from '@/lib/actions/commitment-validation';

type Judgment = 'real' | 'false';

const CONF_STYLE: Record<string, { label: string; color: string }> = {
  high: { label: 'sicher', color: '#5ee08a' },
  medium: { label: 'mittel', color: '#E8B86D' },
  low: { label: 'unsicher', color: '#ff8a8a' },
};

export function CommitmentValidationClient() {
  const [report, setReport] = useState<DryRunReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(20);
  const [days, setDays] = useState(28);
  const [judgments, setJudgments] = useState<Record<string, Judgment>>({});
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      setError(null);
      const res = await dryRunCommitmentScan({ limit, days });
      if (!res.ok) {
        setError(res.error);
        setReport(null);
        return;
      }
      setReport(res);
      setJudgments({});
    });

  const judge = (key: string, v: Judgment) =>
    setJudgments((j) => ({ ...j, [key]: j[key] === v ? undefined! : v }));

  const stats = useMemo(() => {
    const vals = Object.values(judgments).filter(Boolean);
    const real = vals.filter((v) => v === 'real').length;
    const wrong = vals.filter((v) => v === 'false').length;
    const judged = real + wrong;
    const precision = judged > 0 ? Math.round((real / judged) * 100) : null;
    return { real, wrong, judged, precision };
  }, [judgments]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <header className="mb-6">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-300">Schritt 0 · Wedge-Test</p>
        <h1 className="mt-1 text-[22px] font-semibold text-ink-50">Zusagen-Extraktion validieren</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-300">
          Jagt deine echten gesendeten Mails durch <span className="text-ink-100">dieselbe</span> Pipeline, die live
          läuft — schreibt nichts in die DB. Markiere jede Kandidaten-Zusage als <span className="text-[#5ee08a]">echt</span>{' '}
          oder <span className="text-[#ff8a8a]">falsch</span>. Die Precision unten sagt dir, ob der Wedge trägt.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-[14px] border border-white/[0.06] bg-white/[0.015] p-4">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">Mails</span>
          <input
            type="number"
            min={1}
            max={40}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="w-20 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[13px] text-ink-50"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">Tage zurück</span>
          <input
            type="number"
            min={1}
            max={60}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-20 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[13px] text-ink-50"
          />
        </label>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="rounded-full border border-[#5E9EFF]/25 bg-[#5E9EFF]/[0.08] px-4 py-1.5 text-[13px] text-[#5E9EFF] transition-colors hover:bg-[#5E9EFF]/[0.14] disabled:opacity-50"
        >
          {pending ? 'Scanne deine Mails …' : 'Validierungs-Scan starten'}
        </button>
        <p className="text-[11px] text-ink-300">
          Pro Mail ein KI-Call (gedrosselt). Bei knappem Gateway-Limit kleiner anfangen.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-[12px] border border-[#ff8a8a]/25 bg-[#ff8a8a]/[0.06] px-4 py-3 text-[13px] text-[#ff8a8a]">
          {error}
        </div>
      )}

      {report && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Mails gescannt" value={report.mailsFetched} />
            <Stat label="mit Text" value={report.mailsWithBody} />
            <Stat label="mit Kandidaten" value={report.mailsWithCandidates} />
            <Stat label="Kandidaten gesamt" value={report.totalCandidates} />
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-[12px] border border-white/[0.06] bg-white/[0.015] px-4 py-3 text-[12.5px]">
            <span className="text-ink-300">Confidence-Verteilung:</span>
            <span style={{ color: CONF_STYLE.high.color }}>{report.byConfidence.high} sicher</span>
            <span style={{ color: CONF_STYLE.medium.color }}>{report.byConfidence.medium} mittel</span>
            <span style={{ color: CONF_STYLE.low.color }}>{report.byConfidence.low} unsicher</span>
            {stats.judged > 0 && (
              <span className="ml-auto font-mono text-[12px] text-ink-100">
                Precision: <span className="text-[#5ee08a]">{stats.precision}%</span>{' '}
                <span className="text-ink-300">
                  ({stats.real}✓ / {stats.wrong}✗ von {report.totalCandidates})
                </span>
              </span>
            )}
          </div>

          {report.rateLimited && (
            <div className="mb-6 rounded-[12px] border border-[#E8B86D]/25 bg-[#E8B86D]/[0.06] px-4 py-3 text-[12.5px] text-[#E8B86D]">
              KI-Limit (Gateway) erreicht — Scan vorzeitig gestoppt. Ergebnis ist nur ein Teil. Später erneut oder kleinere Stichprobe.
            </div>
          )}

          <ul className="flex flex-col gap-3">
            {report.mails
              .filter((m) => m.candidates.length > 0)
              .map((m, mi) => (
                <li key={mi} className="rounded-[14px] border border-white/[0.06] bg-white/[0.015] p-4">
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13px] text-ink-100">{m.subject || '(kein Betreff)'}</span>
                    <span className="shrink-0 text-[11px] text-ink-300">
                      an {m.to ?? '—'} · {new Date(m.receivedAt).toLocaleDateString('de-DE')}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {m.candidates.map((c, ci) => {
                      const key = `${mi}:${ci}`;
                      const j = judgments[key];
                      const conf = CONF_STYLE[c.confidence] ?? CONF_STYLE.medium;
                      return (
                        <li
                          key={ci}
                          className="rounded-[10px] border border-white/[0.05] bg-black/20 p-3"
                          style={j === 'false' ? { opacity: 0.5 } : undefined}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] text-ink-50">{c.promise}</span>
                            <span
                              className="rounded-full px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.3px]"
                              style={{ color: conf.color, background: `${conf.color}1a` }}
                            >
                              {conf.label}
                            </span>
                            {c.dueIso && (
                              <span className="font-mono text-[10.5px] text-ink-300">
                                fällig {new Date(c.dueIso).toLocaleDateString('de-DE')}
                              </span>
                            )}
                            <span className="ml-auto flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => judge(key, 'real')}
                                className="rounded-md px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.3px] transition-colors"
                                style={
                                  j === 'real'
                                    ? { background: '#5ee08a22', color: '#5ee08a' }
                                    : { color: '#9c9c9d' }
                                }
                              >
                                ✓ echt
                              </button>
                              <button
                                type="button"
                                onClick={() => judge(key, 'false')}
                                className="rounded-md px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.3px] transition-colors"
                                style={
                                  j === 'false'
                                    ? { background: '#ff8a8a22', color: '#ff8a8a' }
                                    : { color: '#9c9c9d' }
                                }
                              >
                                ✗ falsch
                              </button>
                            </span>
                          </div>
                          {c.quote && (
                            <p className="mt-1.5 border-l-2 border-white/10 pl-2.5 text-[12px] italic leading-relaxed text-ink-300">
                              „{c.quote}"
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
          </ul>

          {report.totalCandidates === 0 && (
            <p className="rounded-[12px] border border-white/[0.06] bg-white/[0.015] px-4 py-5 text-center text-[13px] text-ink-300">
              Keine Kandidaten gefunden. Entweder enthielten die Mails keine Zusagen — oder die Extraktion ist zu
              streng/zu schwach. Beides ist ein Ergebnis.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.015] px-3 py-2.5">
      <div className="font-mono text-[20px] tabular-nums text-ink-50">{value}</div>
      <div className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.3px] text-ink-300">{label}</div>
    </div>
  );
}
