'use client';

import { useState, useTransition } from 'react';

type Turn = {
  question: string;
  answer?: string;
  toolsUsed?: string[];
  error?: string;
};

/**
 * Workspace-aware AI side-panel for notes. Single-turn Q&A in v1 — tools loop
 * happens server-side, response shown with citations of tools used. Streaming
 * not strictly required since most answers are short.
 */
export function AIPanel({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, start] = useTransition();

  if (!enabled) return null;

  const ask = () => {
    const q = question.trim();
    if (!q) return;
    setTurns((prev) => [...prev, { question: q }]);
    setQuestion('');
    start(async () => {
      try {
        const res = await fetch('/api/notes/ai', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ question: q }),
        });
        const data = await res.json();
        setTurns((prev) =>
          prev.map((t, i) =>
            i === prev.length - 1
              ? data.ok
                ? { ...t, answer: data.answer, toolsUsed: data.toolsUsed }
                : { ...t, error: data.error ?? 'unknown-error' }
              : t
          )
        );
      } catch (e) {
        setTurns((prev) =>
          prev.map((t, i) =>
            i === prev.length - 1 ? { ...t, error: 'network-error' } : t
          )
        );
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed right-4 top-20 z-30 inline-flex items-center gap-1.5 rounded-full border border-[#5eb6ff]/30 bg-[#5eb6ff]/[0.08] px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.3px] text-[#5eb6ff] backdrop-blur-md hover:bg-[#5eb6ff]/[0.14]"
      >
        🤖 {open ? 'AI schließen' : 'AI fragen'}
      </button>
      {open && (
        <aside className="fixed bottom-0 right-0 top-0 z-40 flex w-full max-w-[440px] flex-col border-l border-white/[0.08] bg-[rgba(14,15,18,0.96)] backdrop-blur-xl">
          <header className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.3px] text-[#5eb6ff]">
              🤖 Workspace-AI
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ml-auto rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300 hover:bg-white/[0.06] hover:text-ink-50"
            >
              ✕
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {turns.length === 0 ? (
              <div className="flex flex-col gap-3 text-[12.5px] text-ink-300">
                <p className="font-medium text-ink-100">Frag was über deinen Workspace.</p>
                <p>
                  Die AI hat Zugriff auf echte Daten: Kunden, Verträge, Nachrichten,
                  Termine, Notizen — nicht nur den Text dieser Seite.
                </p>
                <div className="flex flex-col gap-1.5 pt-2">
                  <Hint
                    onClick={() => setQuestion('Was ist mit Kunde Müller in den letzten 14 Tagen passiert?')}
                    text="Was ist mit Kunde Müller in den letzten 14 Tagen passiert?"
                  />
                  <Hint
                    onClick={() => setQuestion('Welche Verträge laufen in den nächsten 30 Tagen aus?')}
                    text="Welche Verträge laufen in den nächsten 30 Tagen aus?"
                  />
                  <Hint
                    onClick={() => setQuestion('Wer sind meine Top-5 Leads gerade?')}
                    text="Wer sind meine Top-5 Leads gerade?"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {turns.map((t, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <p className="rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12.5px] text-ink-100">
                      <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
                        Du:
                      </span>{' '}
                      {t.question}
                    </p>
                    {t.error && (
                      <p className="rounded-[10px] border border-[#ff8a8a]/30 bg-[#ff8a8a]/[0.06] px-3 py-2 text-[12px] text-[#ff8a8a]">
                        Fehler: {t.error}
                      </p>
                    )}
                    {!t.answer && !t.error && (
                      <p className="rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] text-ink-300">
                        Denke nach …
                      </p>
                    )}
                    {t.answer && (
                      <div className="flex flex-col gap-1.5">
                        <p className="whitespace-pre-wrap rounded-[10px] border border-[#5eb6ff]/20 bg-[#5eb6ff]/[0.04] px-3 py-2.5 text-[12.5px] leading-[1.55] text-ink-50">
                          {t.answer}
                        </p>
                        {t.toolsUsed && t.toolsUsed.length > 0 && (
                          <p className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
                            Quellen: {t.toolsUsed.join(' · ')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask();
            }}
            className="flex items-center gap-2 border-t border-white/[0.06] px-3 py-3"
          >
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Frag was über den Workspace …"
              disabled={pending}
              className="flex-1 rounded-[8px] border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[13px] text-ink-50 outline-none placeholder:text-ink-300 focus:border-white/[0.18] focus:bg-white/[0.04] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={pending || !question.trim()}
              className="rounded-full bg-white px-3 py-2 text-[12px] font-medium leading-none text-black hover:bg-white/90 disabled:opacity-50"
            >
              {pending ? '…' : 'Fragen'}
            </button>
          </form>
        </aside>
      )}
    </>
  );
}

function Hint({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[8px] border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-left text-[11.5px] text-ink-200 hover:border-white/[0.14] hover:bg-white/[0.04]"
    >
      → {text}
    </button>
  );
}
