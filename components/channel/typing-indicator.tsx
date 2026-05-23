'use client';

import { useEffect, useRef, useState } from 'react';
import { useClientEvent } from '@/lib/realtime/pusher-client';

type Typer = { userId: string; name: string; expiresAt: number };

const TYPING_TTL = 4000; // ms

export function TypingIndicator({
  channelId,
  currentUserId,
}: {
  channelId: string | null;
  currentUserId: string;
}) {
  const channelName = channelId ? `presence-channel-${channelId}-typing` : null;
  const [typers, setTypers] = useState<Typer[]>([]);
  const tickRef = useRef<number | null>(null);

  useClientEvent(channelName, 'client-typing', (data: any) => {
    if (!data || !data.userId || data.userId === currentUserId) return;
    const name = String(data.name ?? 'Jemand');
    setTypers((prev) => {
      const next = prev.filter((t) => t.userId !== data.userId);
      next.push({ userId: data.userId, name, expiresAt: Date.now() + TYPING_TTL });
      return next;
    });
  });

  // Periodic cleanup of expired typers
  useEffect(() => {
    if (tickRef.current) return;
    const id = window.setInterval(() => {
      setTypers((prev) => {
        const now = Date.now();
        const next = prev.filter((t) => t.expiresAt > now);
        return next.length === prev.length ? prev : next;
      });
    }, 1000);
    tickRef.current = id;
    return () => {
      if (tickRef.current) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, []);

  if (typers.length === 0) return null;

  const label =
    typers.length === 1
      ? `${typers[0].name} tippt …`
      : typers.length === 2
        ? `${typers[0].name} und ${typers[1].name} tippen …`
        : `${typers.length} tippen …`;

  return (
    <div className="flex items-center gap-2 px-1 py-1 text-[11.5px] text-ink-300">
      <span className="flex gap-1">
        <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-ink-300" />
        <span
          className="inline-block h-1 w-1 animate-pulse rounded-full bg-ink-300"
          style={{ animationDelay: '0.15s' }}
        />
        <span
          className="inline-block h-1 w-1 animate-pulse rounded-full bg-ink-300"
          style={{ animationDelay: '0.3s' }}
        />
      </span>
      <span>{label}</span>
    </div>
  );
}
