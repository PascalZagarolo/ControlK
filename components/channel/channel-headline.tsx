'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateChannelMeta } from '@/lib/actions/channels';
import { MemberStack } from './member-stack';
import type { Channel, ChannelMemberDetail } from '@/lib/types';

export function ChannelHeadline({
  channel,
  channelId,
  members,
  currentUserId,
  isOwner,
}: {
  channel: Channel;
  channelId: string | null;
  members: ChannelMemberDetail[];
  currentUserId: string;
  isOwner: boolean;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-[#1F1F23] pb-3">
      <h1 className="flex items-center gap-1 text-[17px] font-medium leading-none tracking-[-0.1px] text-ink-50">
        <span className="text-ink-300">#</span>
        <span>{channel.name}</span>
      </h1>
      {channel.topic && (
        <p className="min-w-0 flex-1 truncate text-[12.5px] italic leading-none text-ink-300">
          {channel.topic}
        </p>
      )}
      {!channel.topic && <span className="min-w-0 flex-1" />}
      {members.length > 0 && (
        <MemberStack
          members={members}
          currentUserId={currentUserId}
          isOwner={isOwner}
        />
      )}
      {channelId && <HeaderMenu channelId={channelId} channelName={channel.name} />}
    </div>
  );
}

function HeaderMenu({ channelId, channelName }: { channelId: string; channelName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const onArchive = () => {
    if (!confirm(`#${channelName} archivieren?`)) return;
    start(async () => {
      await updateChannelMeta({ channelId, archived: true });
      setOpen(false);
      router.push('/channels');
      router.refresh();
    });
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Channel-Aktionen"
        className="flex h-7 w-7 items-center justify-center rounded-md text-ink-300 transition-colors hover:bg-white/[0.05] hover:text-ink-50"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="5" cy="12" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-30 w-44 overflow-hidden rounded-md border border-[#1F1F23] bg-[#0E0E11] shadow-panel">
          <button
            type="button"
            onClick={onArchive}
            disabled={pending}
            className="flex w-full items-center px-3 py-2 text-left text-[12.5px] text-ink-100 transition-colors hover:bg-white/[0.04] disabled:opacity-40"
          >
            {pending ? 'Archiviere …' : 'Archivieren'}
          </button>
        </div>
      )}
    </div>
  );
}
