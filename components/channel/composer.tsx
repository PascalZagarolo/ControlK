'use client';

import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useComposerStore } from '@/lib/stores/composer-store';
import { sendMessage } from '@/lib/actions/messages';
import { createTodoFromSlash } from '@/lib/actions/todos';
import { VoiceCaptureButton } from '@/components/todos/voice-capture-button';
import type { ChannelSnippet } from '@/lib/types';

export function Composer({
  channelName,
  channelId,
  storageKey,
  snippets = [],
  customerNameForVars,
}: {
  channelName: string;
  channelId?: string;
  storageKey?: string;
  snippets?: ChannelSnippet[];
  customerNameForVars?: string;
}) {
  const key = storageKey ?? `channel:${channelName}`;
  const draft = useComposerStore((s) => s.drafts[key] ?? '');
  const setDraft = useComposerStore((s) => s.setDraft);
  const clearDraft = useComposerStore((s) => s.clearDraft);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: 'todo' | 'error' | 'pinned'; text: string } | null>(null);
  const [snippetPickerOpen, setSnippetPickerOpen] = useState(false);
  const router = useRouter();

  const substituteVars = (text: string): string => {
    if (!customerNameForVars) return text;
    return text.replace(/\{kunde\}/g, customerNameForVars);
  };

  const submit = () => {
    const val = draft.trim();
    if (!val || pending) return;

    // /todo slash
    const slashTodo = val.match(/^\/todo\s+(.+)/is);
    if (slashTodo && channelId) {
      const body = slashTodo[1];
      start(async () => {
        const res = await createTodoFromSlash(channelId, body);
        if (res.ok) {
          clearDraft(key);
          if (textareaRef.current) textareaRef.current.style.height = 'auto';
          setFeedback({ kind: 'todo', text: '✓ Todo erstellt' });
          router.refresh();
          setTimeout(() => setFeedback(null), 2500);
        } else {
          setFeedback({ kind: 'error', text: res.error });
        }
      });
      return;
    }

    // /snippet name
    const slashSnippet = val.match(/^\/snippet\s+(\S+)\s*(.*)$/is);
    if (slashSnippet) {
      const snip = snippets.find(
        (s) => s.slug === slashSnippet[1].toLowerCase() || s.title.toLowerCase() === slashSnippet[1].toLowerCase()
      );
      if (snip) {
        setDraft(key, substituteVars(snip.body));
        return;
      }
      setFeedback({ kind: 'error', text: `Snippet /${slashSnippet[1]} nicht gefunden` });
      return;
    }

    // Regular message
    if (!channelId) {
      clearDraft(key);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      return;
    }
    start(async () => {
      const res = await sendMessage({ channelId, body: val });
      if (res.ok) {
        clearDraft(key);
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        router.refresh();
      } else {
        setFeedback({ kind: 'error', text: res.error });
      }
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
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

  const isSlash = draft.trim().startsWith('/');
  const slashKind = draft.trim().startsWith('/todo')
    ? 'todo'
    : draft.trim().startsWith('/snippet')
      ? 'snippet'
      : null;

  return (
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-40 flex justify-center px-4 pb-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={`pointer-events-auto w-full max-w-[760px] rounded-[18px] border bg-[rgba(20,21,23,0.85)] shadow-panel backdrop-blur-xl backdrop-saturate-150 transition-colors ${
          isSlash ? 'border-[#c084fc]/40' : 'border-white/[0.08]'
        }`}
      >
        {slashKind === 'todo' && (
          <div className="border-b border-white/[0.06] px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.4px] text-[#c084fc]">
            /todo — wird als Aufgabe gespeichert, nicht als Nachricht
          </div>
        )}
        {slashKind === 'snippet' && (
          <div className="border-b border-white/[0.06] px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.4px] text-[#5eb6ff]">
            /snippet — Saved-Reply einfügen ({snippets.length} verfügbar)
          </div>
        )}
        {feedback && (
          <div
            className={`border-b border-white/[0.06] px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.4px] ${
              feedback.kind === 'error' ? 'text-[#ff8a8a]' : 'text-[#5ee08a]'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Snippet quick-picker — dropdown when typing /snippet */}
        {slashKind === 'snippet' && snippets.length > 0 && (
          <div className="max-h-[200px] overflow-y-auto border-b border-white/[0.06] p-1">
            {snippets.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setDraft(key, substituteVars(s.body));
                  textareaRef.current?.focus();
                }}
                className="flex w-full items-start gap-2 rounded-[6px] px-2 py-1.5 text-left hover:bg-white/[0.04]"
              >
                <span className="font-mono text-[10.5px] uppercase tracking-[0.3px] text-[#5eb6ff]">
                  /{s.slug}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-medium text-ink-50">{s.title}</span>
                  <span className="mt-0.5 line-clamp-1 block text-[11px] text-ink-300">
                    {s.body}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 p-2.5 pl-4">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(key, e.target.value)}
            onInput={onInput}
            onKeyDown={onKeyDown}
            placeholder={`Nachricht an ${channelName.startsWith('#') ? channelName : `#${channelName}`} … /todo, /snippet`}
            rows={1}
            className="flex-1 resize-none bg-transparent py-1.5 text-[14.5px] leading-[1.55] text-ink-50 outline-none placeholder:text-ink-300"
          />
          <div className="flex shrink-0 items-center gap-2">
            <VoiceCaptureButton
              onTranscript={(t) => setDraft(key, draft ? draft + ' ' + t : t)}
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">⌘↵</span>
            <button
              type="submit"
              disabled={!draft.trim() || pending}
              className="rounded-full bg-white px-3.5 py-1.5 text-[12.5px] font-medium leading-none text-black transition-opacity duration-150 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {pending ? '…' : slashKind === 'todo' ? 'Todo' : 'Senden'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
