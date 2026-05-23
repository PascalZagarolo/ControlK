'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { MessageItem } from './message-item';
import { Avatar } from './avatar';
import { Panel } from '@/components/ui/panel';
import type { Message } from '@/lib/types';

export function ThreadPanel({
  parent,
  onClose,
}: {
  parent: Message;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState('');
  const ta = useRef<HTMLTextAreaElement>(null);

  const send = () => {
    if (!draft.trim()) return;
    console.log('Thread reply:', draft);
    setDraft('');
    if (ta.current) ta.current.style.height = 'auto';
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
    }
  };

  const onInput = () => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  useEffect(() => {
    const onEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const replies = parent.threadReplies ?? [];

  return (
    <aside className="fixed right-4 top-[88px] z-30 hidden w-[360px] flex-col gap-3 lg:flex">
      <Panel
        label={`Thread · ${replies.length} Antwort${replies.length === 1 ? '' : 'en'}`}
        trailing={
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="flex h-7 w-7 items-center justify-center rounded-full text-ink-300 transition-colors hover:bg-white/[0.06] hover:text-ink-50"
          >
            ✕
          </button>
        }
      >
        <div className="rounded-[10px] border border-white/[0.04] bg-white/[0.02] p-3">
          <div className="flex items-center gap-2">
            <Avatar
              initials={parent.authorInitials}
              from={parent.authorFrom}
              to={parent.authorTo}
              size={20}
            />
            <span className="text-[12px] font-medium leading-none text-ink-50">
              {parent.authorName}
            </span>
          </div>
          <p className="mt-2 line-clamp-3 text-[12.5px] leading-[1.5] text-ink-200">
            {parent.body}
          </p>
        </div>

        <div className="mt-4 flex max-h-[50vh] flex-col gap-4 overflow-y-auto">
          {replies.length === 0 ? (
            <div className="text-center text-[12px] text-ink-300">Noch keine Antworten.</div>
          ) : (
            replies.map((r) => <MessageItem key={r.id} message={r} />)
          )}
        </div>

        <div className="mt-4 rounded-[12px] border border-white/[0.08] bg-[rgba(20,21,23,0.7)] p-2">
          <textarea
            ref={ta}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onInput={onInput}
            onKeyDown={onKey}
            placeholder="Im Thread antworten …"
            rows={1}
            className="block w-full resize-none bg-transparent px-2 py-1.5 text-[13px] leading-[1.5] text-ink-50 outline-none placeholder:text-ink-300"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
              ⌘↵
            </span>
            <button
              type="button"
              onClick={send}
              disabled={!draft.trim()}
              className="rounded-full bg-white px-3 py-1.5 text-[11.5px] font-medium leading-none text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
            >
              Senden
            </button>
          </div>
        </div>
      </Panel>
    </aside>
  );
}
