'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar } from './avatar';
import { clockTime } from '@/lib/format-time';
import { reactToMessage, removeReaction } from '@/lib/actions/channels';
import type { ChannelEntityHit, Message } from '@/lib/types';

const QUICK_REACTIONS = ['🔥', '✓', '📎', '👍', '❤️', '👀'];

const ENTITY_COLOR: Record<ChannelEntityHit['kind'], string> = {
  customer: '#5eb6ff',
  contract: '#ffd96a',
  vehicle: '#c084fc',
  todo: '#5ee08a',
};

function renderBodyWithMentions(body: string, hits: ChannelEntityHit[]): React.ReactNode {
  if (hits.length === 0) return body;
  // Find all match positions, sort by start, render with spans
  const matches: { hit: ChannelEntityHit; start: number; end: number }[] = [];
  const lower = body.toLowerCase();
  for (const h of hits) {
    const m = h.matchText.toLowerCase();
    let idx = 0;
    while ((idx = lower.indexOf(m, idx)) !== -1) {
      matches.push({ hit: h, start: idx, end: idx + m.length });
      idx += m.length;
    }
  }
  matches.sort((a, b) => a.start - b.start);
  // Filter out overlapping matches (keep first)
  const dedup: typeof matches = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      dedup.push(m);
      lastEnd = m.end;
    }
  }
  if (dedup.length === 0) return body;

  const out: React.ReactNode[] = [];
  let pos = 0;
  for (const m of dedup) {
    if (m.start > pos) out.push(body.slice(pos, m.start));
    out.push(
      <EntityPill key={`${m.start}-${m.hit.targetId}`} hit={m.hit} text={body.slice(m.start, m.end)} />
    );
    pos = m.end;
  }
  if (pos < body.length) out.push(body.slice(pos));
  return out;
}

function EntityPill({ hit, text }: { hit: ChannelEntityHit; text: string }) {
  const color = ENTITY_COLOR[hit.kind];
  return (
    <Link
      href={hit.href}
      title={`${hit.kind} · ${hit.label}`}
      className="inline-flex items-baseline gap-0.5 rounded-[3px] px-1 py-0.5 font-medium transition-colors hover:brightness-125"
      style={{ background: `${color}1a`, color }}
    >
      {text}
    </Link>
  );
}

export function MessageItem({
  message,
  compact,
  onOpenThread,
  onReply,
  entityHits = [],
  isCustomerContact,
  customerName,
}: {
  message: Message;
  compact?: boolean;
  onOpenThread?: (m: Message) => void;
  onReply?: (m: Message) => void;
  entityHits?: ChannelEntityHit[];
  isCustomerContact?: boolean;
  customerName?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const replyCount = message.threadReplies?.length ?? 0;

  const react = (emoji: string) => {
    start(async () => {
      const res = await reactToMessage({ messageId: message.id, emoji });
      if (res.ok && res.triggered) {
        const label = res.triggered === 'todo' ? '✓ Todo erstellt' : '✓ Gepinned';
        setFeedback(label);
        setTimeout(() => setFeedback(null), 2500);
      }
      router.refresh();
    });
  };

  const scrollToReplyTarget = () => {
    if (!message.replyTo) return;
    const el = document.getElementById(`message-${message.replyTo.id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('reply-flash');
    window.setTimeout(() => el.classList.remove('reply-flash'), 1400);
  };

  return (
    <div id={`message-${message.id}`} className="group/message relative flex gap-3.5">
      <div className="pt-0.5">
        {compact ? (
          <div className="w-9" aria-hidden />
        ) : (
          <div className="relative">
            <Avatar
              initials={message.authorInitials}
              from={message.authorFrom}
              to={message.authorTo}
            />
            {isCustomerContact && (
              <span
                title={customerName ? `Customer-Contact · ${customerName}` : 'Customer-Contact'}
                className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-ink-900 bg-[#5ee08a] font-mono text-[8px] uppercase tracking-[0.3px] text-black"
              >
                ⌖
              </span>
            )}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {message.replyTo && (
          <button
            type="button"
            onClick={scrollToReplyTarget}
            className="group/replyto mb-1 flex max-w-full items-center gap-1.5 text-left"
            title="Zur Original-Nachricht"
          >
            <span aria-hidden className="text-[11px] leading-none text-ink-300/70 group-hover/replyto:text-ink-300">
              ↰
            </span>
            <span className="min-w-0 truncate text-[12px] leading-tight">
              <span className="font-medium text-ink-200 group-hover/replyto:text-ink-50">
                {message.replyTo.authorName}
              </span>
              <span className="ml-1.5 text-ink-300 group-hover/replyto:text-ink-200">
                {message.replyTo.deleted ? (
                  <span className="italic">Nachricht gelöscht</span>
                ) : (
                  message.replyTo.bodyPreview
                )}
              </span>
            </span>
          </button>
        )}
        {!compact && (
          <div className="flex items-baseline gap-2">
            <span className="text-[14px] font-medium leading-none text-ink-50">
              {message.authorName}
            </span>
            {isCustomerContact && (
              <span className="inline-flex h-4 items-center gap-1 rounded-full bg-[#5ee08a]/[0.18] px-1.5 font-mono text-[9px] uppercase tracking-[0.3px] text-[#5ee08a]">
                Kunde {customerName ? `· ${customerName}` : ''}
              </span>
            )}
            <span className="font-mono text-[10.5px] uppercase tracking-[0.3px] text-ink-300">
              {clockTime(message.timestamp)}
            </span>
          </div>
        )}
        <p
          className={`mt-1 whitespace-pre-line text-[14.5px] leading-[1.6] ${
            isCustomerContact ? 'text-ink-100' : 'text-ink-200'
          }`}
        >
          {renderBodyWithMentions(message.body, entityHits)}
        </p>

        {message.reactions && message.reactions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.reactions.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => react(r.emoji)}
                disabled={pending}
                className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[11.5px] text-ink-200 transition-colors duration-150 hover:border-white/15 hover:bg-white/[0.06]"
              >
                <span>{r.emoji}</span>
                <span className="font-mono text-[10px] text-ink-300">{r.count}</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-2 flex items-center gap-2">
          {replyCount > 0 && onOpenThread && (
            <button
              type="button"
              onClick={() => onOpenThread(message)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11.5px] text-ink-200 hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-ink-50"
            >
              <span>↳</span>
              <span>
                {replyCount} Antwort{replyCount === 1 ? '' : 'en'}
              </span>
            </button>
          )}
          {onOpenThread && replyCount === 0 && (
            <button
              type="button"
              onClick={() => onOpenThread(message)}
              className="hidden font-mono text-[10.5px] uppercase tracking-[0.3px] text-ink-300 hover:text-ink-50 group-hover/message:inline-flex"
            >
              Im Thread antworten
            </button>
          )}
          {feedback && (
            <span className="font-mono text-[10.5px] uppercase tracking-[0.3px] text-[#5ee08a]">
              {feedback}
            </span>
          )}
        </div>
      </div>

      {/* Hover reaction toolbar */}
      <div className="pointer-events-auto absolute -top-2 right-0 hidden items-center gap-0.5 rounded-full border border-white/[0.10] bg-[#16181d] px-1 py-0.5 shadow-lg group-hover/message:flex">
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => react(emoji)}
            disabled={pending}
            title={
              emoji === '🔥'
                ? '🔥 → Todo erstellen'
                : emoji === '📎'
                  ? '📎 → Im Channel pinnen'
                  : emoji
            }
            className="flex h-6 w-6 items-center justify-center rounded-full text-[13px] transition-transform hover:scale-125"
          >
            {emoji}
          </button>
        ))}
        {onReply && (
          <button
            type="button"
            onClick={() => onReply(message)}
            title="Antworten"
            aria-label="Antworten"
            className="flex h-6 w-6 items-center justify-center rounded-full text-ink-300 hover:bg-white/[0.05] hover:text-ink-50"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="9 17 4 12 9 7" />
              <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
            </svg>
          </button>
        )}
        {onOpenThread && (
          <button
            type="button"
            onClick={() => onOpenThread(message)}
            title="Thread öffnen"
            className="flex h-6 w-6 items-center justify-center rounded-full text-[12px] text-ink-300 hover:bg-white/[0.05] hover:text-ink-50"
          >
            ↳
          </button>
        )}
      </div>
    </div>
  );
}
