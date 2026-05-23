'use client';

// Re-export from the Provider so existing imports keep working.
export {
  usePusherChannel as useChannelSubscription,
  usePresenceChannel,
  useClientEvent,
  usePusher,
} from '@/components/realtime/pusher-provider';
