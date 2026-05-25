'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Copy, ExternalLink, RefreshCw, Sparkles, X } from 'lucide-react';
import {
  generateFollowUpDraft,
  type FollowUpDraft,
} from '@/lib/actions/inverse-drafts';
import { acknowledgeStandstill } from '@/lib/actions/inverse-calendar';

export function FollowUpDraftModal({
  thresholdId,
  recipientEmail,
  recipientName,
  onClose,
}: {
  thresholdId: string;
  recipientEmail: string;
  recipientName: string;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<FollowUpDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const runGenerate = () => {
    setError(null);
    start(async () => {
      const res = await generateFollowUpDraft(thresholdId);
      if (res.ok) setDraft(res.draft);
      else setError(res.error);
    });
  };

  // Auto-fire once on open
  useEffect(() => {
    runGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCopy = async () => {
    if (!draft) return;
    const text = `Betreff: ${draft.subject}\n\n${draft.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback('Kopiert');
      setTimeout(() => setCopyFeedback(null), 2000);
      void acknowledgeStandstill(thresholdId);
    } catch {
      setError('Kopieren ins Clipboard fehlgeschlagen.');
    }
  };

  const onOpenGmail = () => {
    if (!draft) return;
    const url = new URL('https://mail.google.com/mail/');
    url.searchParams.set('view', 'cm');
    url.searchParams.set('fs', '1');
    url.searchParams.set('to', recipientEmail);
    url.searchParams.set('su', draft.subject);
    url.searchParams.set('body', draft.body);
    window.open(url.toString(), '_blank');
    void acknowledgeStandstill(thresholdId);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={ref}
        onClick={(e) => e.stopPropagation()}
        className="flex w-[520px] max-w-[90vw] flex-col gap-4 rounded-[12px] border border-[#1F1F23] bg-[#161618] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-start gap-2">
          <Sparkles size={14} strokeWidth={1.75} className="mt-1 shrink-0 text-[#E8B86D]" />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-300">
              Nachfass-Entwurf
            </p>
            <h2 className="mt-0.5 text-[15px] font-medium text-ink-50">
              {recipientName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="flex h-6 w-6 items-center justify-center rounded-md text-ink-300 hover:bg-white/[0.05] hover:text-ink-50"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        <div className="flex items-center gap-2 text-[12px] text-ink-300">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em]">An:</span>
          <span>{recipientEmail}</span>
        </div>

        {pending && !draft && (
          <div className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-6 text-[12.5px] italic text-ink-300">
            <Sparkles size={12} strokeWidth={1.75} className="animate-pulse text-[#E8B86D]" />
            <span>Schreibe Entwurf basierend auf deinem letzten Kontakt …</span>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-[#ff8a8a]/30 bg-[#ff8a8a]/[0.06] px-3 py-2 text-[12.5px] text-[#ff8a8a]">
            {error}
          </div>
        )}

        {draft && (
          <>
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-300">
                Betreff
              </label>
              <input
                value={draft.subject}
                onChange={(e) =>
                  setDraft({ ...draft, subject: e.target.value })
                }
                className="rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[13.5px] text-ink-50 outline-none focus:border-white/[0.16]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-300">
                Nachricht
              </label>
              <textarea
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                rows={8}
                className="resize-y rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[13px] leading-[1.55] text-ink-50 outline-none focus:border-white/[0.16]"
              />
            </div>
          </>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-[#1F1F23] pt-3">
          <button
            type="button"
            onClick={runGenerate}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11.5px] text-ink-200 transition-colors hover:border-white/[0.16] hover:text-ink-50 disabled:opacity-50"
          >
            <RefreshCw size={11} strokeWidth={2} className={pending ? 'animate-spin' : ''} />
            <span>Neu generieren</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCopy}
              disabled={!draft || pending}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11.5px] text-ink-200 transition-colors hover:border-white/[0.16] hover:text-ink-50 disabled:opacity-40"
            >
              <Copy size={11} strokeWidth={2} />
              <span>{copyFeedback ?? 'Kopieren'}</span>
            </button>
            <button
              type="button"
              onClick={onOpenGmail}
              disabled={!draft || pending}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#E8B86D]/[0.18] px-3 py-1 text-[12px] font-medium text-[#E8B86D] transition-opacity hover:bg-[#E8B86D]/[0.28] disabled:opacity-40"
            >
              <ExternalLink size={11} strokeWidth={2} />
              <span>In Gmail öffnen</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
