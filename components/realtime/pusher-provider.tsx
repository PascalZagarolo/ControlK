'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type PusherClient from 'pusher-js';

type Ctx = {
  client: PusherClient | null;
  appKey: string | null;
  cluster: string;
  enabled: boolean;
};

const PusherContext = createContext<Ctx>({
  client: null,
  appKey: null,
  cluster: 'eu',
  enabled: false,
});

let _singleton: PusherClient | null = null;

export function PusherProvider({
  config,
  userId,
  children,
}: {
  config: { appKey: string; cluster: string } | null;
  userId?: string;
  children: React.ReactNode;
}) {
  const [client, setClient] = useState<PusherClient | null>(_singleton);

  useEffect(() => {
    if (!config) return;
    if (_singleton) {
      setClient(_singleton);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const mod = await import('pusher-js');
        const PusherCtor = mod.default;
        const c = new PusherCtor(config.appKey, {
          cluster: config.cluster,
          forceTLS: true,
          // Pusher will hit this endpoint for private/presence channels:
          authEndpoint: '/api/pusher/auth',
          auth: userId
            ? {
                headers: { 'X-User-Id': userId },
                params: { userId },
              }
            : undefined,
        });
        _singleton = c;
        if (!cancelled) setClient(c);
      } catch (e) {
        console.error('[pusher] failed to initialize', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [config, userId]);

  const value = useMemo<Ctx>(
    () => ({
      client,
      appKey: config?.appKey ?? null,
      cluster: config?.cluster ?? 'eu',
      enabled: !!config,
    }),
    [client, config]
  );

  return <PusherContext.Provider value={value}>{children}</PusherContext.Provider>;
}

export function usePusher() {
  return useContext(PusherContext);
}

export function usePusherChannel(
  channelName: string | null,
  events: Record<string, (data: any) => void>
) {
  const { client } = usePusher();
  const handlersRef = useRef(events);
  handlersRef.current = events;

  useEffect(() => {
    if (!client || !channelName) return;
    const channel = client.subscribe(channelName);
    const bound: { event: string; fn: (data: any) => void }[] = [];
    for (const [event, fn] of Object.entries(handlersRef.current)) {
      const wrapper = (data: any) => fn(data);
      channel.bind(event, wrapper);
      bound.push({ event, fn: wrapper });
    }
    return () => {
      for (const b of bound) channel.unbind(b.event, b.fn);
      client.unsubscribe(channelName);
    };
  }, [client, channelName]);
}

/**
 * Subscribe to a presence channel and get the live list of online users.
 */
export function usePresenceChannel(channelName: string | null): {
  members: { id: string; info: Record<string, unknown> }[];
} {
  const { client } = usePusher();
  const [members, setMembers] = useState<
    { id: string; info: Record<string, unknown> }[]
  >([]);

  useEffect(() => {
    if (!client || !channelName) return;
    const channel = client.subscribe(channelName) as any;
    const refresh = () => {
      const out: { id: string; info: Record<string, unknown> }[] = [];
      channel.members?.each?.((m: any) => {
        out.push({ id: m.id, info: m.info ?? {} });
      });
      setMembers(out);
    };
    channel.bind('pusher:subscription_succeeded', refresh);
    channel.bind('pusher:member_added', refresh);
    channel.bind('pusher:member_removed', refresh);
    return () => {
      channel.unbind_all?.();
      client.unsubscribe(channelName);
    };
  }, [client, channelName]);

  return { members };
}

/**
 * Emit + listen for client events (e.g. typing indicators).
 * Requires private- or presence- channel.
 */
export function useClientEvent(
  channelName: string | null,
  event: string,
  onReceive?: (data: any) => void
): (data: any) => void {
  const { client } = usePusher();
  const handlerRef = useRef(onReceive);
  handlerRef.current = onReceive;

  useEffect(() => {
    if (!client || !channelName || !onReceive) return;
    const channel = client.subscribe(channelName);
    const wrapper = (data: any) => handlerRef.current?.(data);
    channel.bind(event, wrapper);
    return () => {
      channel.unbind(event, wrapper);
    };
  }, [client, channelName, event, onReceive]);

  return (data: any) => {
    if (!client || !channelName) return;
    const channel: any = client.channel(channelName) ?? client.subscribe(channelName);
    try {
      channel.trigger(event, data);
    } catch {
      // Pusher throws if channel is public — silently ignore.
    }
  };
}
