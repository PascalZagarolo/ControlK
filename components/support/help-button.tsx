'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Bottom-right help affordance — visible on every page, free-tier included.
 * The brief: "Notions Support-Reputation ist schlecht; das ist mit kleinem
 * Team einfacher zu schlagen als technische Punkte."
 *
 * Modal stays simple: 3-4 most-asked things → direct link, then a clear
 * "schreib mir direkt" mailto for everything else. As the user-base grows,
 * the mailto becomes a support-channel of Channels.
 */
export function HelpButton() {
  // Production: hidden entirely. Dev: hidden by default, toggle via
  // ⌘+Shift+H (H = Help). Keeps the visual surface clean while the
  // affordance is still reachable when the developer needs it.
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setRevealed((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Render nothing in production. In dev, render only after reveal-shortcut.
  if (process.env.NODE_ENV === 'production' || !revealed) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Hilfe"
        className="fixed bottom-6 right-6 z-30 hidden h-6 w-6 items-center justify-center rounded-full border border-[#1F1F23] text-[11px] text-[#52525B] backdrop-blur-md transition-colors duration-150 ease-out hover:border-[#2A2A30] hover:text-[#A1A1AA] md:flex"
        style={{ background: 'rgba(14, 14, 17, 0.55)' }}
      >
        ?
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[300] flex items-end justify-end p-5"
        >
          <div
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <div className="relative flex w-[min(420px,calc(100vw-24px))] flex-col gap-4 rounded-[18px] border border-white/[0.08] bg-[rgba(14,15,18,0.96)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
                Hilfe
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-auto rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300 hover:bg-white/[0.06] hover:text-ink-50"
              >
                Esc
              </button>
            </div>

            <p className="text-[14px] font-medium leading-tight text-ink-50">
              Steckst du fest?
            </p>

            <div className="flex flex-col gap-1.5">
              <HelpItem
                href="/todos/brief"
                title="Daily Brief vorlesen"
                hint="Vorgelesen in 90 Sek · ⌘B"
              />
              <HelpItem
                href="/settings/ai"
                title="Eigenen OpenAI-Key hinterlegen (BYOK)"
                hint="Keine Limits, keine Markups · ⌘."
              />
              <HelpItem
                href="/settings/integrations"
                title="Integrationen verbinden"
                hint="Google Calendar, Slack, GitHub …"
              />
              <HelpItem
                href="/settings/billing"
                title="Plan & Abrechnung"
                hint="Kostenlos für Solo-User"
              />
            </div>

            <div className="rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-[12px] leading-[1.5] text-ink-200">
              <p className="font-medium text-ink-50">Direkter Kontakt</p>
              <p className="mt-1 text-ink-300">
                Solo-Builder. Antwort in der Regel innerhalb 24 Stunden.
              </p>
              <a
                href="mailto:zagarolopascal@gmail.com?subject=uRent%20Support"
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-medium text-black hover:bg-white/90"
              >
                E-Mail schreiben →
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function HelpItem({ href, title, hint }: { href: string; title: string; hint: string }) {
  return (
    <Link
      href={href}
      className="flex items-start gap-2 rounded-[8px] border border-white/[0.06] bg-white/[0.02] px-3 py-2 hover:border-white/[0.14] hover:bg-white/[0.04]"
    >
      <span className="flex-1 text-[12.5px] text-ink-100">{title}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">→</span>
      <span className="block w-full text-[10.5px] text-ink-300">{hint}</span>
    </Link>
  );
}
