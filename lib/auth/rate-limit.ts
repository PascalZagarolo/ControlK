import 'server-only';

type LimitName =
  | 'sign-in'
  | 'sign-up'
  | 'forgot-password'
  | 'magic-link'
  | 'totp-verify'
  | 'oauth-google'
  | 'booking';

const CONFIG: Record<LimitName, { tokens: number; windowSec: number }> = {
  'sign-in': { tokens: 5, windowSec: 60 },
  'sign-up': { tokens: 3, windowSec: 60 * 60 },
  'forgot-password': { tokens: 3, windowSec: 60 * 60 },
  'magic-link': { tokens: 5, windowSec: 60 * 60 },
  'totp-verify': { tokens: 10, windowSec: 60 * 60 },
  // OAuth start is cheap (DB insert + redirect). Keep a generous bucket
  // since legitimate users may re-click in seconds. Real abuse signal is
  // callback-failure rate, not start rate.
  'oauth-google': { tokens: 20, windowSec: 60 },
  booking: { tokens: 5, windowSec: 60 * 60 },
};

const upstashEnabled = () =>
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

let _limiters: Partial<Record<LimitName, any>> = {};

async function getLimiter(name: LimitName) {
  if (!upstashEnabled()) return null;
  if (_limiters[name]) return _limiters[name];
  const { Ratelimit } = await import('@upstash/ratelimit');
  const { Redis } = await import('@upstash/redis');
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  const cfg = CONFIG[name];
  _limiters[name] = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(cfg.tokens, `${cfg.windowSec} s`),
    prefix: `urent:rl:${name}`,
  });
  return _limiters[name];
}

export async function checkRateLimit(
  name: LimitName,
  key: string
): Promise<{ ok: boolean; retryAfterSec?: number }> {
  const limiter = await getLimiter(name);
  if (!limiter) return { ok: true }; // no-op when Upstash not configured
  const res = await limiter.limit(key);
  if (res.success) return { ok: true };
  const retryAfterSec = Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
  return { ok: false, retryAfterSec };
}
