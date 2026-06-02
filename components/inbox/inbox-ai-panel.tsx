'use client';

/**
 * AI helpers on the inbox detail view: summarize the email into a gist +
 * action items, or draft a reply. The reply draft now reads the WHOLE thread
 * (server-side) for context and — when gmail.send is granted — can be sent
 * straight from Ctrl+K after the user reviews it. Never auto-sends.
 */
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { summarizeInboxEmail, type SuggestedAction } from '@/lib/actions/inbox-ai';
import { draftReply, sendReply } from '@/lib/actions/reply';
import { createTodoFromForm } from '@/lib/actions/todos';
import { toast } from '@/lib/stores/toast-store';

const GMAIL_SEND = 'https://www.googleapis.com/auth/gmail.send';

export function InboxAiPanel({
  itemId,
  subject,
  from,
  replyTo,
  canReply,
  canSend,
  bodyText,
}: {
  itemId: string;
  subject: string | null;
  from: string | null;
  replyTo: string | null;
  canReply: boolean;
  canSend: boolean;
  bodyText: string | null;
}) {
  const router = useRouter();
  const draftKey = `ctrlk:reply-draft:${itemId}`;
  const [pending, start] = useTransition();
  const [active, setActive] = useState<'summary' | 'draft' | null>(null);
  const [summary, setSummary] = useState<{ summary: string; actions: SuggestedAction[] } | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Send-scope can be granted mid-flow (JIT consent); start from the prop and
  // upgrade from the draft action's fresh check.
  const [sendable, setSendable] = useState(canSend);

  // Restore an in-progress draft after a consent round-trip (the page remounts
  // when the user returns from the Gmail "Senden aktivieren" OAuth redirect).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        setDraft(saved);
        setActive('draft');
      }
    } catch {
      /* ignore storage errors */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

  const updateDraft = (value: string | null) => {
    setDraft(value);
    try {
      if (value && value.trim()) localStorage.setItem(draftKey, value);
      else localStorage.removeItem(draftKey);
    } catch {
      /* ignore storage errors */
    }
  };

  const runDraft = () => {
    setError(null);
    setActive('draft');
    setSent(false);
    start(async () => {
      const res = await draftReply({ inboxItemId: itemId });
      if (res.ok) {
        updateDraft(res.draft);
        setSendable(res.canSend); // reflect a freshly-granted send scope
      } else setError(res.error);
    });
  };

  const copy = () => {
    if (!draft) return;
    navigator.clipboard?.writeText(draft).then(
      () => toast('Entwurf kopiert', 'success'),
      () => toast('Kopieren fehlgeschlagen', 'danger')
    );
  };

  const send = () => {
    if (!draft?.trim()) return;
    if (!window.confirm(`Antwort an ${replyTo ?? 'den Absender'} senden?`)) return;
    setError(null);
    start(async () => {
      const res = await sendReply({ inboxItemId: itemId, body: draft });
      if (res.ok) {
        setSent(true);
        updateDraft(null); // clear the persisted draft once it's out
        toast('Antwort gesendet', 'success');
        router.refresh();
      } else {
        setError(res.error);
        toast(res.error ?? 'Senden fehlgeschlagen', 'danger');
      }
    });
  };

  const upgradeHref =
    `/api/auth/google/start?scopes=${encodeURIComponent(GMAIL_SEND)}` +
    `&from=${encodeURIComponent(`/inbox/${itemId}`)}`;

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
        {canReply && (
          <button
            type="button"
            onClick={runDraft}
            disabled={pending}
            className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[12px] text-ink-100 transition-colors hover:border-white/[0.18] hover:text-ink-50 disabled:opacity-50"
          >
            {pending && active === 'draft' ? 'Entwerfe …' : 'Antwort entwerfen'}
          </button>
        )}
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
              {replyTo && (
                <p className="mb-1.5 font-mono text-[11px] text-ink-300">
                  An: <span className="text-ink-100">{replyTo}</span>
                </p>
              )}
              <textarea
                value={draft}
                onChange={(e) => {
                  updateDraft(e.target.value);
                  setSent(false);
                }}
                rows={8}
                disabled={sent}
                className="w-full resize-y rounded-[8px] border border-white/[0.08] bg-black/20 p-3 text-[13px] leading-relaxed text-ink-100 outline-none focus:border-[#5E9EFF]/40 disabled:opacity-60"
              />
              {/* Honest trust note — AI drafted from the thread; you decide. */}
              <p className="mt-1.5 text-[11px] leading-relaxed text-ink-300">
                ✦ KI-Entwurf aus dem ganzen Verlauf — prüf ihn, bevor du sendest. Ctrl+K
                sendet nichts ohne deinen Klick.
              </p>

              {sent ? (
                <p className="mt-2 text-[12px] font-medium text-[#5ee08a]">
                  ✓ Antwort gesendet — sie ist jetzt in deinem Gmail-Thread.
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {sendable ? (
                    <button
                      type="button"
                      onClick={send}
                      disabled={pending || !draft.trim()}
                      className="rounded-full bg-[#5ee08a] px-3.5 py-1 text-[12px] font-semibold text-black transition-colors hover:bg-[#7CEBA0] disabled:opacity-50"
                    >
                      {pending && active === 'draft' ? 'Senden …' : 'Senden'}
                    </button>
                  ) : (
                    <a
                      href={upgradeHref}
                      className="rounded-full bg-[#5ee08a] px-3.5 py-1 text-[12px] font-semibold text-black transition-colors hover:bg-[#7CEBA0]"
                      title="Einmalige Gmail-Berechtigung zum Senden"
                    >
                      Senden aktivieren
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={copy}
                    className="rounded-full border border-white/[0.08] px-3 py-1 text-[12px] text-ink-100 transition-colors hover:border-white/[0.18] hover:text-ink-50"
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
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
