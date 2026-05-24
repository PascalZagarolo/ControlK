import 'server-only';

import {
  newDeviceLoginTemplate,
  passwordChangedTemplate,
  sendMail,
  totpDisabledTemplate,
  totpEnabledTemplate,
} from '@/lib/email/send';

// Friendly device label from a User-Agent string. We don't pull a
// full UA parser — the simple heuristic below covers 95% of mainstream
// browsers, and the IP shown alongside disambiguates the rest.
export function deviceLabelFromUA(ua: string | null): string {
  if (!ua) return 'Unbekanntes Gerät';
  const lower = ua.toLowerCase();
  const browser = lower.includes('firefox')
    ? 'Firefox'
    : lower.includes('edg/')
      ? 'Edge'
      : lower.includes('chrome')
        ? 'Chrome'
        : lower.includes('safari')
          ? 'Safari'
          : 'Browser';
  const os = lower.includes('android')
    ? 'Android'
    : lower.includes('iphone') || lower.includes('ipad')
      ? 'iOS'
      : lower.includes('mac os')
        ? 'macOS'
        : lower.includes('windows')
          ? 'Windows'
          : lower.includes('linux')
            ? 'Linux'
            : 'Unbekannt';
  return `${browser} · ${os}`;
}

export function formatWhen(date: Date): string {
  return date.toLocaleString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type WhenWhereWhat = {
  email: string;
  ip: string | null;
  userAgent: string | null;
};

// All four helpers below are fire-and-forget. Caller doesn't await —
// failures get logged but never bubble up to the user-facing action.

export function sendPasswordChangedAlert(args: WhenWhereWhat): void {
  void sendMail({
    to: args.email,
    ...passwordChangedTemplate({
      when: formatWhen(new Date()),
      ip: args.ip ?? 'unbekannt',
      device: deviceLabelFromUA(args.userAgent),
    }),
  }).catch((e) => console.error('[security-mail] password-changed:', e));
}

export function sendTotpEnabledAlert(args: WhenWhereWhat): void {
  void sendMail({
    to: args.email,
    ...totpEnabledTemplate({
      when: formatWhen(new Date()),
      ip: args.ip ?? 'unbekannt',
      device: deviceLabelFromUA(args.userAgent),
    }),
  }).catch((e) => console.error('[security-mail] totp-enabled:', e));
}

export function sendTotpDisabledAlert(args: WhenWhereWhat): void {
  void sendMail({
    to: args.email,
    ...totpDisabledTemplate({
      when: formatWhen(new Date()),
      ip: args.ip ?? 'unbekannt',
      device: deviceLabelFromUA(args.userAgent),
    }),
  }).catch((e) => console.error('[security-mail] totp-disabled:', e));
}

export function sendNewDeviceLoginAlert(args: WhenWhereWhat): void {
  void sendMail({
    to: args.email,
    ...newDeviceLoginTemplate({
      when: formatWhen(new Date()),
      ip: args.ip ?? 'unbekannt',
      device: deviceLabelFromUA(args.userAgent),
    }),
  }).catch((e) => console.error('[security-mail] new-device:', e));
}
