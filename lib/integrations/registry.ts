/**
 * Integration registry — shared shape for every external integration uRent
 * knows about. Adding a new integration = adding a new entry here and
 * implementing the lib/integrations/<key>/ files. Settings UI iterates this
 * registry to render the integration list automatically.
 */

export type IntegrationKey =
  | 'google-calendar'
  | 'outlook'
  | 'slack'
  | 'github'
  | 'linear';

export type IntegrationStatus =
  | { state: 'stub' } // routes exist but feature not implemented
  | { state: 'available' } // ready, user can connect
  | { state: 'connected'; lastSyncAt?: string }
  | { state: 'error'; message: string };

export type IntegrationMeta = {
  key: IntegrationKey;
  label: string;
  description: string;
  category: 'calendar' | 'chat' | 'dev' | 'project';
  icon: string;
  /**
   * If false, the integration card shows "Demnächst" instead of "Verbinden".
   * Flip true once OAuth callback + sync engine are wired.
   */
  ready: boolean;
  envHints?: string[]; // required env vars the operator must configure
};

export const INTEGRATIONS: IntegrationMeta[] = [
  {
    key: 'google-calendar',
    label: 'Google Calendar',
    description: 'Zwei-Wege-Sync zwischen uRent-Kalender und Google Calendar.',
    category: 'calendar',
    icon: '📅',
    ready: false,
    envHints: ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET'],
  },
  {
    key: 'outlook',
    label: 'Outlook',
    description: 'Zwei-Wege-Sync mit Outlook-Kalender und To-Dos.',
    category: 'calendar',
    icon: '📨',
    ready: false,
    envHints: ['MS_OAUTH_CLIENT_ID', 'MS_OAUTH_CLIENT_SECRET'],
  },
  {
    key: 'slack',
    label: 'Slack',
    description: '/urent Slash-Command + Channel-Webhooks → uRent-Messages.',
    category: 'chat',
    icon: '💬',
    ready: false,
    envHints: ['SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET', 'SLACK_SIGNING_SECRET'],
  },
  {
    key: 'github',
    label: 'GitHub',
    description: 'PR-Status + Issues an Todos hängen.',
    category: 'dev',
    icon: '⌨',
    ready: false,
    envHints: ['GITHUB_APP_ID', 'GITHUB_APP_PRIVATE_KEY'],
  },
  {
    key: 'linear',
    label: 'Linear',
    description: 'Linear-Issues read-only als Live-Embed.',
    category: 'project',
    icon: '◫',
    ready: false,
    envHints: ['LINEAR_OAUTH_CLIENT_ID', 'LINEAR_OAUTH_CLIENT_SECRET'],
  },
];

export function isIntegrationConfigured(key: IntegrationKey): boolean {
  const meta = INTEGRATIONS.find((i) => i.key === key);
  if (!meta) return false;
  return (meta.envHints ?? []).every((env) => !!process.env[env]);
}
