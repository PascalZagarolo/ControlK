'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChannelHeadline } from '@/components/channel/channel-headline';
import { MessageItem } from '@/components/channel/message-item';
import { DateSeparator } from '@/components/channel/date-separator';
import { Composer } from '@/components/channel/composer';
import { ContextPanel } from '@/components/channel/context-panel';
import { LeftPanel } from '@/components/channel/left-panel';
import { ThreadPanel } from '@/components/channel/thread-panel';
import { ChannelSwitcher } from '@/components/channel/channel-switcher';
import { PinnedStrip } from '@/components/channel/pinned-strip';
import { SnippetsModal } from '@/components/channel/snippets-modal';
import { ChannelSearchModal } from '@/components/channel/search-modal';
import { ShareChannelModal } from '@/components/channel/share-channel-modal';
import { bucketLabel, dayBucket } from '@/lib/format-time';
import { markChannelRead } from '@/lib/actions/channels';
import type {
  Channel,
  ChannelEntityHit,
  ChannelSnippet,
  Message,
} from '@/lib/types';

export function ChannelDetailClient({
  channel,
  channelId,
  messages,
  channels,
  entityHitsByMsg,
  customerContactEmails,
  snippets,
}: {
  channel: Channel;
  channelId: string | null;
  messages: Message[];
  channels: { slug: string; name: string; unread?: number }[];
  entityHitsByMsg?: Record<string, ChannelEntityHit[]>;
  customerContactEmails?: Record<string, { customerId: string; customerName: string }>;
  snippets?: ChannelSnippet[];
}) {
  const [contextOpen, setContextOpen] = useState(true);
  const [leftOpen, setLeftOpen] = useState(true);
  const [openThread, setOpenThread] = useState<Message | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [snippetsOpen, setSnippetsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const groups = useMemo(() => groupByDay(messages), [messages]);

  const showContext = contextOpen && !openThread;
  const padLeft = leftOpen ? 'lg:pl-[336px]' : '';
  const padRight = showContext || openThread ? 'lg:pr-[388px]' : '';

  // Mark as read on mount
  useEffect(() => {
    if (channelId) {
      void markChannelRead(channelId);
    }
  }, [channelId]);

  // ⌘K Search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="relative min-h-screen bg-ink-900">
      <div
        className={`mx-auto w-full transition-[padding] duration-300 ease-soft ${padLeft} ${padRight}`}
      >
        <div className="mx-auto w-full max-w-[760px] px-6 pb-40 pt-28">
          <ChannelHeadline
            channel={channel}
            channelId={channelId}
            contextOpen={contextOpen}
            onToggleContext={() => setContextOpen((o) => !o)}
            onOpenSwitcher={() => setSwitcherOpen(true)}
          />

          {/* Action-Strip */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11.5px] text-ink-200 hover:border-white/[0.14] hover:bg-white/[0.04]"
            >
              🔍 Suche
              <span className="font-mono text-[9px] text-ink-300">⌘K</span>
            </button>
            <button
              type="button"
              onClick={() => setSnippetsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11.5px] text-ink-200 hover:border-white/[0.14] hover:bg-white/[0.04]"
            >
              💬 Snippets {snippets && snippets.length > 0 && (
                <span className="font-mono text-[9px] text-ink-300">{snippets.length}</span>
              )}
            </button>
            {channelId && (
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11.5px] text-ink-200 hover:border-white/[0.14] hover:bg-white/[0.04]"
              >
                🔗 Teilen
              </button>
            )}
          </div>

          {/* Pinned Strip */}
          {channelId && (
            <div className="mt-4 rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-3">
              <PinnedStrip pinned={channel.pinned} channelId={channelId} />
            </div>
          )}

          {messages.length === 0 ? (
            <div className="mt-16 text-center text-[14px] text-ink-300">
              Noch keine Nachrichten in diesem Channel.
            </div>
          ) : (
            <div className="mt-8 flex flex-col gap-1.5">
              {groups.map((group) => (
                <div key={group.bucket} className="flex flex-col">
                  <DateSeparator label={bucketLabel(group.bucket)} />
                  <div className="mt-2 flex flex-col gap-5">
                    {group.items.map((m, i) => {
                      const prev = group.items[i - 1];
                      const compact =
                        !!prev &&
                        prev.authorName === m.authorName &&
                        timeWithin(prev.timestamp, m.timestamp, 5 * 60_000);
                      const hits = entityHitsByMsg?.[m.id] ?? [];
                      // Customer-contact detection: lookup by author name maps not available
                      // → use author display name as proxy via lookups by initials+name?
                      // Better: match author's email (passed in customerContactEmails by user-id mapping in server-page)
                      const contactMatch = (m as any).authorEmail
                        ? customerContactEmails?.[(m as any).authorEmail.toLowerCase()]
                        : undefined;
                      return (
                        <MessageItem
                          key={m.id}
                          message={m}
                          compact={compact}
                          onOpenThread={(msg) => setOpenThread(msg)}
                          entityHits={hits}
                          isCustomerContact={!!contactMatch}
                          customerName={contactMatch?.customerName}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {leftOpen && <LeftPanel channel={channel} onClose={() => setLeftOpen(false)} />}
      {showContext && <ContextPanel channel={channel} onClose={() => setContextOpen(false)} />}
      {openThread && <ThreadPanel parent={openThread} onClose={() => setOpenThread(null)} />}

      <ChannelSwitcher
        open={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        activeSlug={channel.slug}
        channels={channels}
      />

      <Composer
        channelName={channel.name}
        channelId={channelId ?? undefined}
        snippets={snippets ?? []}
        customerNameForVars={channel.linkedCustomer?.name}
      />

      <SnippetsModal
        open={snippetsOpen}
        onClose={() => setSnippetsOpen(false)}
        snippets={snippets ?? []}
      />
      <ChannelSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      {channelId && (
        <ShareChannelModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          channelId={channelId}
          channelName={channel.name}
        />
      )}
    </div>
  );
}

type Group = { bucket: string; items: Message[] };

function groupByDay(messages: Message[]): Group[] {
  const buckets = new Map<string, Message[]>();
  const order: string[] = [];
  for (const m of messages) {
    const b = dayBucket(m.timestamp);
    if (!buckets.has(b)) {
      buckets.set(b, []);
      order.push(b);
    }
    buckets.get(b)!.push(m);
  }
  return order.map((b) => ({ bucket: b, items: buckets.get(b)! }));
}

function timeWithin(a: string, b: string, ms: number): boolean {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) <= ms;
}
