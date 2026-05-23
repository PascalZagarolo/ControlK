'use client';

import { Avatar } from './avatar';
import { BulkCaptureButton } from './bulk-capture-button';
import type { Channel } from '@/lib/types';

export function ChannelHeadline({
  channel,
  channelId,
  onToggleContext,
  contextOpen,
  onOpenSwitcher,
}: {
  channel: Channel;
  channelId?: string | null;
  onToggleContext: () => void;
  contextOpen: boolean;
  onOpenSwitcher: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onOpenSwitcher}
        className="inline-flex w-fit items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.4px] text-ink-300 transition-colors hover:text-ink-50"
      >
        <span>Channel</span>
        <span className="opacity-70">↔</span>
        <span className="opacity-70">Wechseln</span>
      </button>
      <h1 className="text-[36px] font-medium leading-[1.05] tracking-[-0.6px] text-ink-50 md:text-[44px]">
        #{channel.name}
      </h1>
      <p className="max-w-[560px] text-[14.5px] leading-[1.55] text-ink-200">{channel.topic}</p>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2.5">
          <div className="flex -space-x-2">
            {channel.membersPreview.slice(0, 4).map((m, i) => (
              <span key={i} className="rounded-full ring-2 ring-ink-900">
                <Avatar initials={m.initials} from={m.from} to={m.to} size={22} />
              </span>
            ))}
          </div>
          <span className="font-mono text-[11px] uppercase tracking-[0.3px] text-ink-300">
            {channel.members} Mitglieder
          </span>
          {channel.unread > 0 && (
            <>
              <span className="text-ink-300/40">·</span>
              <span className="font-mono text-[11px] uppercase tracking-[0.3px] text-ink-200">
                {channel.unread} ungelesen
              </span>
            </>
          )}
        </div>

        {channelId && (
          <span className="ml-auto">
            <BulkCaptureButton channelId={channelId} />
          </span>
        )}

        <button
          type="button"
          onClick={onToggleContext}
          className={`${channelId ? '' : 'ml-auto '}inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium leading-none transition-colors duration-150 ${
            contextOpen
              ? 'border-white/15 bg-white/[0.08] text-ink-50'
              : 'border-white/[0.06] bg-white/[0.02] text-ink-200 hover:border-white/10 hover:bg-white/[0.04] hover:text-ink-50'
          }`}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M15 3v18" />
          </svg>
          Kontext {contextOpen ? 'ausblenden' : 'einblenden'}
        </button>
      </div>
    </div>
  );
}
