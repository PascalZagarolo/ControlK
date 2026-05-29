'use client';

/**
 * AI helpers on the inbox detail view: summarize the email into a gist +
 * action items, or draft a reply. The email body is passed in from the page
 * (fetched from Gmail at render time), so these actions don't re-hit Gmail.
 * The reply is a draft to copy — Ctrl K doesn't send mail.
 */
import { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { draftInboxReply, summarizeInboxEmail } from '@/lib/actions/inbox-ai';
import { toast } from '@/lib/stores/toast-store';

export function InboxAiPanel({
  subject,
  from,
  bodyText,
}: {
  subject: string | null;
  from: string | null;
  bodyText: string | null;
}) {
  const [pending, start] = useTransition();
  const [active, setActive] = useState<'summary' | 'draft' | null>(null);
  const [summary, setSummary] = useState<{ summary: string; actions: string[] } | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSummary = () => {
    setError(null);
    setActive('summary');
    start(async () => {
      const res = await summarizeInboxEmail({ subject, from, bodyText });
      if (res.ok) setSummary({ summary: res.summary, actions: res.actions });
      else setError(res.error);
    });
  };

  const runDraft = () => {
    setError(null);
    setActive('draft');
    start(async () => {
      const res = await draftInboxReply({ subject, from, bodyText });
      if (res.ok) setDraft(res.draft);
      else setError(res.error);
    });
  };

  const copy = () => {
    if (!draft) return;
    navigator.clipboard?.writeText(draft).then(
      () => toast('Entwurf kopiert', 'success'),
      () => toast('Kopieren fehlgeschlagen', 'danger')
    );
  };

  return (
    <section className="rounded-[12px] border border-[#5E9EFF]/15 bg-[#5E9EFF]/[0.04] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.4px] text-[#5E9EFF]">
          <span aria-hidden>✦</span> KI
        </span>
        <button
          type="button"
          onClick={runSummary}
          disabled={pending}
          className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[12px] text-ink-100 transition-colors hover:border-white/[0.18] hover:text-ink-50 disabled:opacity-50"
        >
          {pending && active === 'summary' ? 'Fasse zusammen …' : 'Zusammenfassen'}
        </button>
        <button
          type="button"
          onClick={runDraft}
          disabled={pending}
          className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[12px] text-ink-100 transition-colors hover:border-white/[0.18] hover:text-ink-50 disabled:opacity-50"
        >
          {pending && active === 'draft' ? 'Entwerfe …' : 'Antwort entwerfen'}
        </button>
      </div>

      {error && <p className="mt-2 text-[12px] text-[#ff8a8a]">⚠ {error}</p>}

      <AnimatePresence initial={false}>
        {summary && (
          <motion.div
            key="summary"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-[8px] bg-black/20 p-3">
              <p className="text-[13px] leading-relaxed text-ink-100">{summary.summary}</p>
              {summary.actions.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {summary.actions.map((a, i) => (
                    <li key={i} className="flex gap-2 text-[12.5px] text-ink-200">
                      <span aria-hidden className="text-[#5E9EFF]">▪</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}

        {draft !== null && (
          <motion.div
            key="draft"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={8}
                className="w-full resize-y rounded-[8px] border border-white/[0.08] bg-black/20 p-3 text-[13px] leading-relaxed text-ink-100 outline-none focus:border-[#5E9EFF]/40"
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={copy}
                  className="rounded-full bg-[#5E9EFF] px-3 py-1 text-[12px] font-medium text-black transition-colors hover:bg-[#7CB0FF]"
                >
                  Kopieren
                </button>
                <button
                  type="button"
                  onClick={runDraft}
                  disabled={pending}
                  className="rounded-full border border-white/[0.08] px-3 py-1 text-[12px] text-ink-300 transition-colors hover:text-ink-50 disabled:opacity-50"
                >
                  Neu entwerfen
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
