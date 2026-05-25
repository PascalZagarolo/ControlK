'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChannelHeadline } from '@/components/channel/channel-headline';
import { MessageItem } from '@/components/channel/message-item';
import { DateSeparator } from '@/components/channel/date-separator';
import { Composer } from '@/components/channel/composer';
import { ThreadPanel } from '@/components/channel/thread-panel';
import { PinnedStrip } from '@/components/channel/pinned-strip';
import { MembersSidebar } from '@/components/channel/members-sidebar';
import { bucketLabel, dayBucket } from '@/lib/format-time';
import { markChannelRead } from '@/lib/actions/channels';
import { useChannelSubscription } from '@/lib/realtime/pusher-client';
import { useRouter } from 'next/navigation';
import type {
  Channel,
  ChannelEntityHit,
  ChannelMemberDetail,
  Message,
} from '@/lib/types';

export function ChannelDetailClient({
  channel,
  channelId,
  messages,
  members,
  currentUserId,
  isOwner,
  entityHitsByMsg,
  customerContactEmails,
}: {
  channel: Channel;
  channelId: string | null;
  messages: Message[];
  members: ChannelMemberDetail[];
  currentUserId: string;
  isOwner: boolean;
  entityHitsByMsg?: Record<string, ChannelEntityHit[]>;
  customerContactEmails?: Record<string, { customerId: string; customerName: string }>;
}) {
  const router = useRouter();
  const [openThread, setOpenThread] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useChannelSubscription(channelId ? `private-channel-${channelId}` : null, {
    'message.new': () => router.refresh(),
    'message.edited': () => router.refresh(),
    'message.deleted': () => router.refresh(),
    'reaction.added': () => router.refresh(),
    'reaction.removed': () => router.refresh(),
  });

  const groups = useMemo(() => groupByDay(messages), [messages]);

  useEffect(() => {
    if (channelId) {
      void markChannelRead(channelId);
    }
  }, [channelId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <div className="flex h-full min-h-0 bg-ink-900">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-[#1F1F23] px-6 pt-5">
          <div className="mx-auto w-full max-w-[760px]">
            <ChannelHeadline
              channel={channel}
              channelId={channelId}
              members={members}
              currentUserId={currentUserId}
              isOwner={isOwner}
            />
          </div>
        </div>

        {channelId && channel.pinned.length > 0 && (
          <div className="shrink-0 border-b border-[#1F1F23] bg-[#0C0C0F] px-6 py-2">
            <div className="mx-auto w-full max-w-[760px]">
              <PinnedStrip pinned={channel.pinned} channelId={channelId} />
            </div>
          </div>
        )}

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto w-full max-w-[760px]">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-1 py-24 text-center">
                <p className="text-[13.5px] italic text-ink-300">
                  Noch keine Nachrichten in #{channel.name}.
                </p>
                <p className="text-[13.5px] italic text-ink-300/70">Schreib die erste.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
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
                        const contactMatch = (m as any).authorEmail
                          ? customerContactEmails?.[(m as any).authorEmail.toLowerCase()]
                          : undefined;
                        return (
                          <MessageItem
                            key={m.id}
                            message={m}
                            compact={compact}
                            onOpenThread={(msg) => setOpenThread(msg)}
                            onReply={(msg) => setReplyTo(msg)}
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

        <div className="shrink-0 border-t border-[#1F1F23] bg-ink-900 px-6 pb-4 pt-3">
          <div className="mx-auto w-full max-w-[760px]">
            <Composer
              channelName={channel.name}
              channelId={channelId ?? undefined}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
            />
          </div>
        </div>
      </div>

      <MembersSidebar members={members} currentUserId={currentUserId} isOwner={isOwner} />

      {openThread && <ThreadPanel parent={openThread} onClose={() => setOpenThread(null)} />}
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
