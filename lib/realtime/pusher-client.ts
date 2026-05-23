'use client';

import { useEffect, useRef } from 'react';
import type Pusher from 'pusher-js';

let _client: Pusher | null = null;

function getClient(): Pusher | null {
  if (_client) return _client;
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? 'eu';
  if (!key) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PusherClient = require('pusher-js').default;
  _client = new PusherClient(key, { cluster, forceTLS: true });
  return _client;
}

export function useChannelSubscription(
  channelName: string | null,
  events: Record<string, (data: unknown) => void>
) {
  const handlersRef = useRef(events);
  handlersRef.current = events;

  useEffect(() => {
    if (!channelName) return;
    const client = getClient();
    if (!client) return;
    const channel = client.subscribe(channelName);
    const bound: { event: string; fn: (data: unknown) => void }[] = [];
    for (const [event, fn] of Object.entries(handlersRef.current)) {
      const wrapper = (data: unknown) => fn(data);
      channel.bind(event, wrapper);
      bound.push({ event, fn: wrapper });
    }
    return () => {
      for (const b of bound) channel.unbind(b.event, b.fn);
      client.unsubscribe(channelName);
    };
  }, [channelName]);
}
