'use client';

/**
 * AI helpers on the inbox detail view: summarize the email into a gist +
 * action items, or draft a reply. The email body is passed in from the page
 * (fetched from Gmail at render time), so these actions don't re-hit Gmail.
 * The reply is a draft to copy — Ctrl K doesn't send mail.
 */
import { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { draftInboxReply, summarizeInboxEmail, type SuggestedAction } from '@/lib/actions/inbox-ai';
import { createTodoFromForm } from '@/lib/actions/todos';
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
  const [summary, setSummary] = useState<{ summary: string; actions: SuggestedAction[] } | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addedTodos, setAddedTodos] = useState<Set<number>>(new Set());
  // One-tap dismiss per suggested action (R3) — same gesture as everywhere.
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const addTodo = (index: number, title: string) => {
    start(async () => {
      const fd = new FormData();
      fd.set('title', title);
      const res = await createTodoFromForm(fd);
      if (res.ok) {
        setAddedTodos((s) => new Set(s).add(index));
        toast('→ Todo erstellt', 'success');
      } else {
        toast(res.error ?? 'Konnte Todo nicht erstellen', 'danger');
      }
    });
  };

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
              {summary.actions.some((_, i) => !dismissed.has(i)) && (
                <>
                  <p className="mt-3 font-mono text-[9.5px] uppercase tracking-[0.3px] text-ink-300">
                    Vorgeschlagene Aufgaben · du entscheidest
                  </p>
                  <ul className="mt-1.5 flex flex-col gap-2">
                    {summary.actions.map((a, i) => {
                      if (dismissed.has(i)) return null;
                      const added = addedTodos.has(i);
                      // R2 — high = assertion, medium/low = question framing.
                      const isQuestion = a.confidence !== 'high';
                      return (
                        <li key={i} className="group flex flex-col gap-1 text-[12.5px]">
                          <div className="flex items-start gap-2">
                            <span aria-hidden className="mt-0.5 text-[#5E9EFF]">▪</span>
                            <span className={`min-w-0 flex-1 ${isQuestion ? 'text-[#E8C99A]' : 'text-ink-100'}`}>
                              {isQuestion ? `Aufgabe? „${a.title}" — übernehmen?` : a.title}
                            </span>
                            <span className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => !added && addTodo(i, a.title)}
                                disabled={pending || added}
                                className={`rounded-full px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.3px] transition-colors ${
                                  added
                                    ? 'text-[#5ee08a]'
                                    : 'text-ink-300 hover:bg-white/[0.06] hover:text-ink-50 disabled:opacity-50'
                                }`}
                              >
                                {added ? '✓ Todo' : '→ Todo'}
                              </button>
                              {!added && (
                                <button
                                  type="button"
                                  onClick={() => setDismissed((s) => new Set(s).add(i))}
                                  className="rounded-full px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.3px] text-ink-300 transition-colors hover:bg-white/[0.06] hover:text-ink-50"
                                  title="Vorschlag verwerfen"
                                >
                                  Verwerfen
                                </button>
                              )}
                            </span>
                          </div>
                          {/* R1 — the mail sentence this action was derived from. */}
                          {a.quote && (
                            <p className="ml-6 border-l-2 border-white/10 pl-2 font-mono text-[11px] italic leading-relaxed text-ink-300">
                              „{a.quote}"
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
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
