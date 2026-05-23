import 'server-only';

// The `pusher` package is CommonJS; its types don't surface a `.default`
// export. We type the singleton as `any` and require it lazily so the SDK
// is only loaded when Pusher env vars are actually present.
let _pusher: any | null = null;

function readConfig() {
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_API_KEY;
  const secret = process.env.PUSHER_API_SECRET;
  const cluster = process.env.PUSHER_CLUSTER ?? 'eu';
  return { appId, key, secret, cluster };
}

function getPusher(): any | null {
  if (_pusher) return _pusher;
  const { appId, key, secret, cluster } = readConfig();
  if (!appId || !key || !secret) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Pusher = require('pusher');
  const Ctor = Pusher.default ?? Pusher;
  _pusher = new Ctor({ appId, key, secret, cluster, useTLS: true });
  return _pusher;
}

export async function triggerEvent(channel: string, event: string, payload: unknown) {
  const p = getPusher();
  if (!p) return;
  try {
    await p.trigger(channel, event, payload);
  } catch (e) {
    console.error('[pusher] trigger failed', e);
  }
}

export async function triggerToChannels(
  channels: string[],
  event: string,
  payload: unknown
) {
  const p = getPusher();
  if (!p || channels.length === 0) return;
  try {
    await p.trigger(channels, event, payload);
  } catch (e) {
    console.error('[pusher] trigger failed', e);
  }
}

export const pusherEnabled = () => {
  const { appId, key, secret } = readConfig();
  return !!appId && !!key && !!secret;
};

/**
 * Public client config — safe to send to the browser.
 * Read in a Server Component and pass into <PusherProvider>.
 */
export function getPusherClientConfig(): { appKey: string; cluster: string } | null {
  const { key, cluster } = readConfig();
  if (!key) return null;
  return { appKey: key, cluster };
}

/**
 * Authenticate a private / presence channel.
 * Called from POST /api/pusher/auth.
 */
export function authorizeChannel(
  socketId: string,
  channel: string,
  presenceData?: { user_id: string; user_info?: Record<string, unknown> }
): unknown | null {
  const p = getPusher();
  if (!p) return null;
  if (presenceData) {
    return (p as any).authorizeChannel(socketId, channel, presenceData);
  }
  return (p as any).authorizeChannel(socketId, channel);
}
