import 'server-only';

let _pusher: import('pusher').default | null = null;

function getPusher(): import('pusher').default | null {
  if (_pusher) return _pusher;
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? 'eu';
  if (!appId || !key || !secret) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Pusher = require('pusher').default;
  _pusher = new Pusher({ appId, key, secret, cluster, useTLS: true });
  return _pusher;
}

export async function triggerEvent(channel: string, event: string, payload: unknown) {
  const p = getPusher();
  if (!p) return; // silently no-op if not configured
  try {
    await p.trigger(channel, event, payload);
  } catch (e) {
    console.error('[pusher] trigger failed', e);
  }
}

export const pusherEnabled = () =>
  !!process.env.PUSHER_APP_ID && !!process.env.PUSHER_SECRET && !!process.env.NEXT_PUBLIC_PUSHER_KEY;
