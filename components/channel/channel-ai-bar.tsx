'use client';

/**
 * Channel AI bar — sits just above the composer. Three moves, all grounded in
 * the channel's recent messages (passed in from the detail client):
 *   • "Hol mich ab" — summarize the conversation + open items.
 *   • "Antwort entwerfen" — draft a reply straight into the composer.
 *   • a small ask box ("/ai") — answer a question about the channel.
 * Collapsible so it stays out of the way until invoked.
 */
import { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { channelAsk, channelReplyDraft, channelSummary } from '@/lib/actions/channel-ai';
import { createTodoFromForm } from '@/lib/actions/todos';
import { useComposerStore } from '@/lib/stores/composer-store';
import { toast } from '@/lib/stores/toast-store';
import type { Message } from '@/lib/types';

export function ChannelAiBar({
  channelName,
  messages,
}: {
  channelName: string;
  messages: Message[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [active, setActive] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ summary: string; openItems: string[] } | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [addedItems, setAddedItems] = useState<Set<number>>(new Set());
  const setDraft = useComposerStore((s) => s.setDraft);

  const addTodo = (index: number, title: string) => {
    start(async () => {
      const fd = new FormData();
      fd.set('title', title);
      const res = await createTodoFromForm(fd);
      if (res.ok) {
        setAddedItems((s) => new Set(s).add(index));
        toast('→ Todo erstellt', 'success');
      } else toast(res.error ?? 'Konnte Todo nicht erstellen', 'danger');
    });
  };

  const payload = () => ({
    channelName,
    messages: messages.slice(-40).map((m) => ({ author: m.authorName, body: m.body })),
  });

  const runSummary = () => {
    setError(null);
    setActive('summary');
    start(async () => {
      const res = await channelSummary(payload());
      if (res.ok) setSummary({ summary: res.summary, openItems: res.openItems });
      else setError(res.error);
    });
  };

  const runDraft = () => {
    setError(null);
    setActive('draft');
    start(async () => {
      const res = await channelReplyDraft(payload());
      if (res.ok) {
        setDraft(`channel:${channelName}`, res.draft);
        toast('Entwurf im Composer', 'success');
      } else setError(res.error);
    });
  };

  const runAsk = () => {
    const q = question.trim();
    if (!q) return;
    setError(null);
    setActive('ask');
    setAnswer(null);
    start(async () => {
      const res = await channelAsk({ ...payload(), question: q });
      if (res.ok) setAnswer(res.answer);
      else setError(res.error);
    });
  };

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300 transition-colors hover:text-[#5E9EFF]"
      >
        <span aria-hidden className="text-[#5E9EFF]">✦</span>
        KI
        <span aria-hidden className="text-[9px] opacity-70">{open ? '▾' : '▸'}</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 flex flex-col gap-2 rounded-[10px] border border-[#5E9EFF]/15 bg-[#5E9EFF]/[0.04] p-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <BarBtn onClick={runSummary} disabled={pending} loading={pending && active === 'summary'}>
                  Hol mich ab
                </BarBtn>
                <BarBtn onClick={runDraft} disabled={pending} loading={pending && active === 'draft'}>
                  Antwort entwerfen
                </BarBtn>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    runAsk();
                  }}
                  className="flex min-w-[180px] flex-1 items-center gap-1.5"
                >
                  <input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    disabled={pending}
                    placeholder="Frag den Channel …"
                    className="min-w-0 flex-1 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1 text-[12px] text-ink-50 outline-none placeholder:text-ink-300 focus:border-[#5E9EFF]/40 disabled:opacity-60"
                  />
                  <BarBtn type="submit" onClick={runAsk} disabled={pending || !question.trim()} loading={pending && active === 'ask'}>
                    Fragen
                  </BarBtn>
                </form>
              </div>

              {error && <p className="text-[12px] text-[#ff8a8a]">⚠ {error}</p>}

              {summary && (
                <div className="rounded-[8px] bg-black/20 p-2.5">
                  <p className="text-[12.5px] leading-relaxed text-ink-100">{summary.summary}</p>
                  {summary.openItems.length > 0 && (
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {summary.openItems.map((it, i) => {
                        const added = addedItems.has(i);
                        return (
                          <li key={i} className="group flex items-start gap-2 text-[12px] text-ink-200">
                            <span aria-hidden className="mt-0.5 text-[#5E9EFF]">▪</span>
                            <span className="min-w-0 flex-1">{it}</span>
                            <button
                              type="button"
                              onClick={() => !added && addTodo(i, it)}
                              disabled={pending || added}
                              className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.3px] transition-colors ${
                                added ? 'text-[#5ee08a]' : 'text-ink-300 hover:bg-white/[0.06] hover:text-ink-50 disabled:opacity-50'
                              }`}
                            >
                              {added ? '✓' : '→ Todo'}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              {answer && (
                <div className="rounded-[8px] bg-black/20 p-2.5">
                  <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-100">{answer}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BarBtn({
  children,
  onClick,
  disabled,
  loading,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={type === 'submit' ? undefined : onClick}
      disabled={disabled}
      className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[12px] text-ink-100 transition-colors hover:border-white/[0.18] hover:text-ink-50 disabled:opacity-50"
    >
      {loading ? '…' : children}
    </button>
  );
}
