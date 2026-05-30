'use client';

/**
 * Customer AI panel — health read + next-best-action and a meeting-prep brief,
 * generated from the customer's contracts / activity / contacts. Surfaced on
 * the customer detail page.
 */
import { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { customerInsight, customerMeetingPrep } from '@/lib/actions/crm-ai';

const RISK_COLOR: Record<string, string> = {
  niedrig: '#5ee08a',
  mittel: '#E8B86D',
  hoch: '#ff8a8a',
};

export function CustomerAiPanel({ customerId }: { customerId: string }) {
  const [pending, start] = useTransition();
  const [active, setActive] = useState<string | null>(null);
  const [insight, setInsight] = useState<{
    summary: string;
    nextAction: string;
    risk: { level: string; reason: string };
  } | null>(null);
  const [prep, setPrep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runInsight = () => {
    setError(null);
    setActive('insight');
    start(async () => {
      const res = await customerInsight(customerId);
      if (res.ok) setInsight({ summary: res.summary, nextAction: res.nextAction, risk: res.risk });
      else setError(res.error);
    });
  };
  const runPrep = () => {
    setError(null);
    setActive('prep');
    start(async () => {
      const res = await customerMeetingPrep(customerId);
      if (res.ok) setPrep(res.brief);
      else setError(res.error);
    });
  };

  return (
    <section className="rounded-[14px] border border-[#5E9EFF]/15 bg-[#5E9EFF]/[0.04] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.4px] text-[#5E9EFF]">
          <span aria-hidden>✦</span> KI-Insights
        </span>
        <button
          type="button"
          onClick={runInsight}
          disabled={pending}
          className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[12px] text-ink-100 transition-colors hover:border-white/[0.18] hover:text-ink-50 disabled:opacity-50"
        >
          {pending && active === 'insight' ? 'Analysiere …' : 'Analyse & Next Step'}
        </button>
        <button
          type="button"
          onClick={runPrep}
          disabled={pending}
          className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[12px] text-ink-100 transition-colors hover:border-white/[0.18] hover:text-ink-50 disabled:opacity-50"
        >
          {pending && active === 'prep' ? 'Erstelle …' : 'Meeting-Prep'}
        </button>
      </div>

      {error && <p className="mt-2 text-[12px] text-[#ff8a8a]">⚠ {error}</p>}

      <AnimatePresence initial={false}>
        {insight && (
          <motion.div
            key="insight"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex flex-col gap-2 rounded-[10px] bg-black/20 p-3">
              <p className="text-[13px] leading-relaxed text-ink-100">{insight.summary}</p>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 font-mono text-[9.5px] uppercase tracking-[0.3px] text-[#5E9EFF]">
                  Next
                </span>
                <p className="text-[13px] font-medium text-ink-50">{insight.nextAction}</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.3px]"
                  style={{
                    background: `${RISK_COLOR[insight.risk.level] ?? '#9c9c9d'}1f`,
                    color: RISK_COLOR[insight.risk.level] ?? '#9c9c9d',
                  }}
                >
                  Risiko {insight.risk.level}
                </span>
                {insight.risk.reason && (
                  <span className="text-[11.5px] text-ink-300">{insight.risk.reason}</span>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {prep && (
          <motion.div
            key="prep"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-[10px] bg-black/20 p-3">
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-100">{prep}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
