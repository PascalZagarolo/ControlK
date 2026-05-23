'use client';

import { usePresenceChannel } from '@/lib/realtime/pusher-client';

/**
 * Tiny presence indicator for collaborative notes. Subscribes to
 * presence-note-{noteId} and renders a stack of avatars for everyone else
 * who has the page open. Pure read-only — multi-cursor / live-edit-merge
 * is deferred (would need CRDT).
 */
export function NotePresence({
  noteId,
  currentUserId,
}: {
  noteId: string;
  currentUserId?: string;
}) {
  const { members } = usePresenceChannel(`presence-note-${noteId}`);
  const others = members.filter((m) => m.id !== currentUserId);
  if (others.length === 0) return null;

  return (
    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3px] text-[#5ee08a]">
      <span>● {others.length} weitere</span>
      <div className="flex -space-x-2">
        {others.slice(0, 4).map((m) => {
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
              className="flex h-6 w-6 items-center justify-center rounded-full font-mono text-[9px] font-semibold text-white ring-2 ring-ink-900"
              style={{
                background: `linear-gradient(180deg, ${info.from ?? '#5eb6ff'} 0%, ${info.to ?? '#0369a1'} 100%)`,
              }}
            >
              {info.initials ?? '?'}
            </span>
          );
        })}
        {others.length > 4 && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.06] font-mono text-[9px] text-ink-200 ring-2 ring-ink-900">
            +{others.length - 4}
          </span>
        )}
      </div>
    </div>
  );
}
