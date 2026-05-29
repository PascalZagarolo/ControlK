'use client';

/**
 * "Ask Ctrl K" — a floating conversational assistant over the workspace.
 * Mounted globally; the button sits bottom-left so it doesn't fight the
 * help / mobile-fab cluster on the right. Talks to the askWorkspace action,
 * which runs the existing workspace tools under the hood.
 */
import { useEffect, useRef, useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { askWorkspace, type AskMessage } from '@/lib/actions/ask';
import { useUIStore } from '@/lib/stores/ui-store';
import { VoiceCaptureButton } from '@/components/todos/voice-capture-button';

const SUGGESTIONS = [
  'Was steht heute an?',
  'Welche Verträge laufen aus?',
  'Wer hat sich lange nicht gemeldet?',
];

export function AskCtrlK() {
  const open = useUIStore((s) => s.askOpen);
  const setOpen = useUIStore((s) => s.setAskOpen);
  const askQuery = useUIStore((s) => s.askQuery);
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [input, setInput] = useState('');
  const [pending, start] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const consumedRef = useRef<string | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pending]);

  const send = (text: string) => {
    const q = text.trim();
    if (!q || pending) return;
    const next: AskMessage[] = [...messages, { role: 'user', content: q }];
    setMessages(next);
    setInput('');
    start(async () => {
      const res = await askWorkspace(next);
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: res.ok ? res.answer : `⚠ ${res.error}` },
      ]);
    });
  };

  // Auto-send a question handed in from ⌘K (once per distinct query).
  useEffect(() => {
    if (open && askQuery && consumedRef.current !== askQuery) {
      consumedRef.current = askQuery;
      send(askQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, askQuery]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Ask Ctrl K"
        className="fixed bottom-5 left-5 z-[120] flex h-11 items-center gap-2 rounded-full border border-white/[0.1] bg-[rgba(17,17,20,0.9)] px-4 text-[13px] font-medium text-ink-50 shadow-[0_8px_28px_rgba(0,0,0,.5)] backdrop-blur-xl transition-colors hover:border-white/[0.2]"
      >
        <span aria-hidden className="text-[#5E9EFF]">✦</span>
        Ask Ctrl K
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="fixed bottom-20 left-5 z-[120] flex h-[min(560px,75vh)] w-[min(400px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-[16px] border border-white/[0.08] bg-[rgba(14,15,18,0.97)] shadow-[0_24px_64px_rgba(0,0,0,.6)] backdrop-blur-xl"
          >
            <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <div className="flex items-center gap-2">
                <span aria-hidden className="text-[13px] text-[#5E9EFF]">✦</span>
                <span className="text-[13px] font-medium text-ink-50">Ask Ctrl K</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Schließen"
                className="text-ink-300 transition-colors hover:text-ink-50"
              >
                <span aria-hidden className="text-[15px] leading-none">×</span>
              </button>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
              {messages.length === 0 ? (
                <div className="flex flex-col gap-3 pt-2">
                  <p className="text-[12.5px] leading-relaxed text-ink-300">
                    Frag mich etwas über deinen Workspace — Kunden, Verträge, Nachrichten,
                    Notizen oder was heute ansteht.
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => send(s)}
                        className="rounded-[8px] border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left text-[12.5px] text-ink-200 transition-colors hover:border-white/[0.14] hover:text-ink-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {messages.map((m, i) => (
                    <div
                      key={i}
                      className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                    >
                      <div
                        className={`max-w-[85%] whitespace-pre-wrap rounded-[12px] px-3 py-2 text-[13px] leading-relaxed ${
                          m.role === 'user'
                            ? 'bg-[#5E9EFF]/[0.14] text-ink-50'
                            : 'bg-white/[0.04] text-ink-100'
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {pending && (
                    <div className="flex justify-start">
                      <div className="rounded-[12px] bg-white/[0.04] px-3 py-2 text-[13px] text-ink-300">
                        <span className="inline-flex gap-1">
                          <Dot delay={0} />
                          <Dot delay={0.15} />
                          <Dot delay={0.3} />
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-center gap-2 border-t border-white/[0.06] px-3 py-2.5"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={pending}
                autoFocus
                placeholder="Frag etwas …"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-ink-50 outline-none placeholder:text-ink-300 disabled:opacity-60"
              />
              <VoiceCaptureButton onTranscript={(t) => send(t)} />
              <button
                type="submit"
                disabled={pending || !input.trim()}
                className="shrink-0 rounded-full bg-[#5E9EFF] px-3 py-1.5 text-[12px] font-medium text-black transition-colors hover:bg-[#7CB0FF] disabled:opacity-40"
              >
                Senden
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <motion.span
      className="inline-block h-1.5 w-1.5 rounded-full bg-ink-300"
      animate={{ opacity: [0.3, 1, 0.3] }}
      transition={{ duration: 1, repeat: Infinity, delay }}
    />
  );
}
