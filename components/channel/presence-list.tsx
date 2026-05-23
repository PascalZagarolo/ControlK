'use client';

import { usePresenceChannel } from '@/lib/realtime/pusher-client';
import { Avatar } from './avatar';

export function PresenceList({ channelId }: { channelId: string | null }) {
  const channelName = channelId ? `presence-channel-${channelId}` : null;
  const { members } = usePresenceChannel(channelName);

  if (members.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-[#5ee08a]">
        ● {members.length} online
      </span>
      <div className="flex -space-x-2">
        {members.slice(0, 5).map((m) => {
          const info = m.info as {
            name?: string;
            initials?: string;
            from?: string;
            to?: string;
          };
          return (
            <span
              key={m.id}
              title={info.name ?? m.id}
              className="rounded-full ring-2 ring-ink-900"
            >
              <Avatar
                initials={info.initials ?? '?'}
                from={info.from ?? '#5eb6ff'}
                to={info.to ?? '#0369a1'}
                size={20}
              />
            </span>
          );
        })}
        {members.length > 5 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.06] font-mono text-[9px] text-ink-200 ring-2 ring-ink-900">
            +{members.length - 5}
          </span>
        )}
      </div>
    </div>
  );
}
