'use client';

import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useComposerStore } from '@/lib/stores/composer-store';
import { sendMessage } from '@/lib/actions/messages';
import type { Message } from '@/lib/types';

export function Composer({
  channelName,
  channelId,
  storageKey,
  replyTo,
  onCancelReply,
}: {
  channelName: string;
  channelId?: string;
  storageKey?: string;
  replyTo?: Message | null;
  onCancelReply?: () => void;
}) {
  const key = storageKey ?? `channel:${channelName}`;
  const draft = useComposerStore((s) => s.drafts[key] ?? '');
  const setDraft = useComposerStore((s) => s.setDraft);
  const clearDraft = useComposerStore((s) => s.clearDraft);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Auto-focus textarea when entering reply mode
  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  const submit = () => {
    const val = draft.trim();
    if (!val || pending || !channelId) return;
    start(async () => {
      const res = await sendMessage({
        channelId,
        body: val,
        replyToId: replyTo?.id,
      });
      if (res.ok) {
        clearDraft(key);
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        setError(null);
        onCancelReply?.();
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape' && replyTo) {
      e.preventDefault();
      onCancelReply?.();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      submit();
    }
  };

  const onInput = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 220)}px`;
  };

  useEffect(() => {
    onInput();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const channelLabel = channelName.startsWith('#') ? channelName : `#${channelName}`;
  const placeholder = replyTo
    ? `Antwort an ${replyTo.authorName} …`
    : `Schreibe in ${channelLabel} …`;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col"
    >
      {replyTo && (
        <div className="flex items-center justify-between rounded-t-[10px] border border-b-0 border-white/[0.08] bg-white/[0.025] px-3 py-1.5">
          <span className="min-w-0 truncate text-[12px] leading-tight text-ink-300">
            <span className="text-ink-300/70">Antwort an </span>
            <span className="font-medium text-ink-100">{replyTo.authorName}</span>
          </span>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Antwort abbrechen"
            className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-300 transition-colors hover:bg-white/[0.06] hover:text-ink-50"
          >
            <X size={12} strokeWidth={2} />
          </button>
        </div>
      )}
      <div
        className={`border border-white/[0.08] bg-[#0E0E11] focus-within:border-white/[0.16] ${
          replyTo ? 'rounded-b-[10px]' : 'rounded-[10px]'
        }`}
      >
        {error && (
          <div className="border-b border-white/[0.06] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.4px] text-[#ff8a8a]">
            {error}
          </div>
        )}
        <div className="flex items-end gap-2 px-3 py-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(key, e.target.value)}
            onInput={onInput}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            rows={1}
            className="flex-1 resize-none bg-transparent py-1 text-[14px] leading-[1.55] text-ink-50 outline-none placeholder:text-ink-300"
          />
          <button
            type="submit"
            disabled={!draft.trim() || pending || !channelId}
            aria-label="Senden"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-300 transition-colors duration-150 hover:bg-white/[0.06] hover:text-ink-50 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-300"
          >
            {pending ? (
              <span className="font-mono text-[11px]">…</span>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            )}
          </button>
        </div>
      </div>
      <p className="mt-1.5 px-1 text-[10.5px] leading-none text-ink-300/70">
        Markdown · Enter senden · Shift+Enter neue Zeile{replyTo ? ' · Esc verwirft Antwort' : ''}
      </p>
    </form>
  );
}
