import 'server-only';

// Thin Gmail REST wrapper. We use raw fetch rather than the official
// `googleapis` npm package because:
//   - googleapis is 30 MB and the build bundles a lot of it.
//   - We only need a tiny slice (5 endpoints), no auth flow code.
//   - Vercel cold-start time matters; less code = faster.
//
// All functions take an already-valid access token. Refreshing happens
// upstream in lib/auth/google-tokens.ts (getValidGoogleAccessToken).

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export class GmailAuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'GmailAuthError';
  }
}

async function gfetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
  if (res.status === 401 || res.status === 403) {
    throw new GmailAuthError(res.status, `Gmail unauthorized (${res.status})`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gmail API ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

// ── Profile (used to capture the initial historyId) ─────────────

export type GmailProfile = {
  emailAddress: string;
  historyId: string;
};

export async function getProfile(accessToken: string): Promise<GmailProfile> {
  return gfetch<GmailProfile>('/profile', accessToken);
}

// ── List messages (initial sync) ────────────────────────────────

type ListMessagesResponse = {
  messages?: { id: string; threadId: string }[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

export async function listInboxMessageIds(
  accessToken: string,
  opts: { maxResults?: number; query?: string } = {}
): Promise<{ id: string; threadId: string }[]> {
  const params = new URLSearchParams();
  params.set('maxResults', String(opts.maxResults ?? 50));
  if (opts.query) params.set('q', opts.query);
  // labelIds=INBOX restricts to the inbox view (vs. all mail).
  params.append('labelIds', 'INBOX');
  const data = await gfetch<ListMessagesResponse>(
    `/messages?${params.toString()}`,
    accessToken
  );
  return data.messages ?? [];
}

// ── History (incremental sync) ──────────────────────────────────

type HistoryRecord = {
  id: string;
  messages?: { id: string; threadId: string }[];
  messagesAdded?: { message: { id: string; threadId: string; labelIds?: string[] } }[];
  messagesDeleted?: { message: { id: string; threadId: string } }[];
  labelsAdded?: { message: { id: string; threadId: string }; labelIds: string[] }[];
  labelsRemoved?: { message: { id: string; threadId: string }; labelIds: string[] }[];
};

type HistoryListResponse = {
  history?: HistoryRecord[];
  nextPageToken?: string;
  historyId?: string;
};

export type GmailHistoryChanges = {
  addedIds: Set<string>;
  removedIds: Set<string>;
  readStateChanges: Map<string, boolean>; // id → isRead
  /** Latest historyId Google returned — store this as the new cursor. */
  newHistoryId: string | null;
};

export async function listHistorySince(
  accessToken: string,
  startHistoryId: string
): Promise<GmailHistoryChanges> {
  const params = new URLSearchParams();
  params.set('startHistoryId', startHistoryId);
  params.set('historyTypes', 'messageAdded');
  params.append('historyTypes', 'messageDeleted');
  params.append('historyTypes', 'labelAdded');
  params.append('historyTypes', 'labelRemoved');

  let pageToken: string | undefined;
  const out: GmailHistoryChanges = {
    addedIds: new Set(),
    removedIds: new Set(),
    readStateChanges: new Map(),
    newHistoryId: null,
  };

  for (let safety = 0; safety < 10; safety++) {
    const pageParams = new URLSearchParams(params);
    if (pageToken) pageParams.set('pageToken', pageToken);
    const data = await gfetch<HistoryListResponse>(
      `/history?${pageParams.toString()}`,
      accessToken
    );
    if (data.historyId) out.newHistoryId = data.historyId;
    for (const h of data.history ?? []) {
      for (const m of h.messagesAdded ?? []) {
        out.addedIds.add(m.message.id);
      }
      for (const m of h.messagesDeleted ?? []) {
        out.removedIds.add(m.message.id);
      }
      for (const l of h.labelsAdded ?? []) {
        if (l.labelIds.includes('UNREAD')) {
          out.readStateChanges.set(l.message.id, false);
        }
      }
      for (const l of h.labelsRemoved ?? []) {
        if (l.labelIds.includes('UNREAD')) {
          out.readStateChanges.set(l.message.id, true);
        }
      }
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return out;
}

// ── Message detail (minimal metadata only) ──────────────────────

type GmailMessageDetail = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string; // ms since epoch as string
  payload?: {
    headers?: { name: string; value: string }[];
  };
};

export type ParsedGmailMessage = {
  id: string;
  threadId: string;
  senderName: string;
  senderEmail: string | null;
  subject: string | null;
  preview: string;
  receivedAt: Date;
  isRead: boolean;
};

export async function getMessageMetadata(
  accessToken: string,
  messageId: string
): Promise<ParsedGmailMessage | null> {
  // format=metadata + headers list keeps Gmail from returning the body
  // payload — much smaller response + within "metadata" scope semantics
  // (gmail.readonly does include bodies, but we intentionally avoid
  // pulling them so we never accidentally persist private content).
  const params = new URLSearchParams();
  params.set('format', 'metadata');
  params.append('metadataHeaders', 'From');
  params.append('metadataHeaders', 'Subject');
  let detail: GmailMessageDetail;
  try {
    detail = await gfetch<GmailMessageDetail>(
      `/messages/${encodeURIComponent(messageId)}?${params.toString()}`,
      accessToken
    );
  } catch (e) {
    if (e instanceof GmailAuthError) throw e;
    // 404 — message deleted between list and detail. Common, ignore.
    return null;
  }

  const headers = detail.payload?.headers ?? [];
  const fromRaw =
    headers.find((h) => h.name.toLowerCase() === 'from')?.value ?? '';
  const subject =
    headers.find((h) => h.name.toLowerCase() === 'subject')?.value ?? null;
  const { name, email } = parseFromHeader(fromRaw);
  const ts = detail.internalDate ? Number(detail.internalDate) : Date.now();

  return {
    id: detail.id,
    threadId: detail.threadId,
    senderName: name,
    senderEmail: email,
    subject,
    preview: (detail.snippet ?? '').trim(),
    receivedAt: new Date(ts),
    isRead: !(detail.labelIds ?? []).includes('UNREAD'),
  };
}

// ── Header parsing ──────────────────────────────────────────────

// RFC-2822 "From: Anna Hoffmann <anna@x.de>" or just "anna@x.de".
// We don't need a full parser — Gmail normalises most input. The
// fallback for malformed values is "use the whole string as name,
// no email".
export function parseFromHeader(raw: string): { name: string; email: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { name: 'Unknown', email: null };
  const match = trimmed.match(/^(.*)<([^>]+)>\s*$/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    const email = match[2].trim();
    return { name: name || email, email };
  }
  // Bare address
  if (trimmed.includes('@')) {
    return { name: trimmed, email: trimmed };
  }
  return { name: trimmed, email: null };
}
