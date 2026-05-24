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
  opts: { maxResults?: number; query?: string; labelIds?: string[] } = {}
): Promise<{ id: string; threadId: string }[]> {
  const params = new URLSearchParams();
  params.set('maxResults', String(opts.maxResults ?? 50));
  if (opts.query) params.set('q', opts.query);
  // Default to INBOX for backward compat. Callers can override (e.g.
  // ['SENT'] for outgoing-mail sync).
  const labels = opts.labelIds ?? ['INBOX'];
  for (const l of labels) params.append('labelIds', l);
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
  /** First recipient parsed from the To header — null when no To present. */
  recipientName: string | null;
  recipientEmail: string | null;
  subject: string | null;
  preview: string;
  receivedAt: Date;
  isRead: boolean;
  /** 'sent' when the message carries the SENT label, otherwise 'inbox'. */
  direction: 'inbox' | 'sent';
  /**
   * Gmail's own category — one of the CATEGORY_* labels Gmail attaches
   * via its native ML classifier. We use this as a heuristic in our
   * own classifier (customer match always wins, but absent that, the
   * Gmail bucket is a strong signal).
   */
  gmailCategory: 'promo' | 'social' | 'updates' | 'forums' | null;
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
  params.append('metadataHeaders', 'To');
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
  const toRaw =
    headers.find((h) => h.name.toLowerCase() === 'to')?.value ?? '';
  const subject =
    headers.find((h) => h.name.toLowerCase() === 'subject')?.value ?? null;
  const { name: senderName, email: senderEmail } = parseFromHeader(fromRaw);
  // To headers may carry multiple recipients separated by commas. We
  // keep only the first — multi-recipient threads still collapse to a
  // single "person you're waiting on" by convention, which matches
  // the user's mental model in most B2B threads.
  const firstTo = toRaw.split(',')[0]?.trim() ?? '';
  const { name: recipientName, email: recipientEmail } = firstTo
    ? parseFromHeader(firstTo)
    : { name: null as string | null, email: null };
  const labelIds = detail.labelIds ?? [];
  const ts = detail.internalDate ? Number(detail.internalDate) : Date.now();

  return {
    id: detail.id,
    threadId: detail.threadId,
    senderName,
    senderEmail,
    recipientName: recipientName || null,
    recipientEmail,
    subject,
    preview: (detail.snippet ?? '').trim(),
    receivedAt: new Date(ts),
    isRead: !labelIds.includes('UNREAD'),
    direction: labelIds.includes('SENT') ? 'sent' : 'inbox',
    gmailCategory: gmailCategoryFromLabels(labelIds),
  };
}

// Maps Gmail's CATEGORY_* labels to our normalized vocab. Gmail can
// attach multiple CATEGORY_* labels to one message (rare); we pick the
// first match in priority order — promo wins because it's the loudest
// signal for "skip the noise".
function gmailCategoryFromLabels(
  labelIds: string[]
): 'promo' | 'social' | 'updates' | 'forums' | null {
  const set = new Set(labelIds);
  if (set.has('CATEGORY_PROMOTIONS')) return 'promo';
  if (set.has('CATEGORY_SOCIAL')) return 'social';
  if (set.has('CATEGORY_UPDATES')) return 'updates';
  if (set.has('CATEGORY_FORUMS')) return 'forums';
  return null;
}

// ── Full message body (for detail view) ────────────────────────

type GmailBodyPart = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailBodyPart[];
};

type GmailFullMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailBodyPart & {
    headers?: { name: string; value: string }[];
  };
};

export type GmailFullBody = {
  id: string;
  threadId: string;
  from: string;
  to: string;
  cc: string | null;
  subject: string;
  date: Date;
  isRead: boolean;
  /** Plain-text body (preferred). Empty string when the message is HTML-only. */
  plain: string;
  /** Whether the source actually contains an HTML body (informational). */
  hasHtml: boolean;
  attachments: { filename: string; mimeType: string; size: number }[];
};

// Gmail encodes everything as URL-safe base64. Standard atob/Buffer.from
// with 'base64' wants '+' and '/', so we substitute back before decoding.
function decodeBase64Url(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  // Buffer is server-only — this file already lives under server-only.
  return Buffer.from(padded, 'base64').toString('utf8');
}

// Walk a Gmail payload tree, picking the best text candidate. We prefer
// text/plain whenever available; the HTML-only fallback is left empty
// in V1 to avoid an XSS surface. Attachments are listed for the UI but
// not downloaded.
function walkPayload(
  payload: GmailBodyPart | undefined
): {
  plain: string;
  hasHtml: boolean;
  attachments: { filename: string; mimeType: string; size: number }[];
} {
  const out = { plain: '', hasHtml: false, attachments: [] as any[] };
  const visit = (node: GmailBodyPart | undefined): void => {
    if (!node) return;
    const mime = (node.mimeType ?? '').toLowerCase();
    const filename = (node.filename ?? '').trim();

    if (filename && node.body?.attachmentId) {
      out.attachments.push({
        filename,
        mimeType: mime || 'application/octet-stream',
        size: node.body.size ?? 0,
      });
      return; // attachments don't contribute to body
    }

    if (mime === 'text/plain' && node.body?.data) {
      if (!out.plain) out.plain = decodeBase64Url(node.body.data);
    } else if (mime === 'text/html' && node.body?.data) {
      out.hasHtml = true;
      // V1: don't decode HTML to avoid sanitiser dependency. If the
      // message is HTML-only, the UI shows the snippet + a hint.
    }

    if (Array.isArray(node.parts)) {
      for (const child of node.parts) visit(child);
    }
  };
  visit(payload);
  return out;
}

function headerOf(
  payload: GmailFullMessage['payload'],
  name: string
): string {
  const v = payload?.headers?.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  )?.value;
  return v ?? '';
}

export async function getFullMessage(
  accessToken: string,
  messageId: string
): Promise<GmailFullBody | null> {
  let raw: GmailFullMessage;
  try {
    raw = await gfetch<GmailFullMessage>(
      `/messages/${encodeURIComponent(messageId)}?format=full`,
      accessToken
    );
  } catch (e) {
    if (e instanceof GmailAuthError) throw e;
    return null;
  }

  const decoded = walkPayload(raw.payload);
  const ts = raw.internalDate ? Number(raw.internalDate) : Date.now();

  return {
    id: raw.id,
    threadId: raw.threadId,
    from: headerOf(raw.payload, 'From'),
    to: headerOf(raw.payload, 'To'),
    cc: headerOf(raw.payload, 'Cc') || null,
    subject: headerOf(raw.payload, 'Subject') || '(kein Betreff)',
    date: new Date(ts),
    isRead: !(raw.labelIds ?? []).includes('UNREAD'),
    plain: decoded.plain,
    hasHtml: decoded.hasHtml,
    attachments: decoded.attachments,
  };
}

// ── Thread (sibling messages in the same conversation) ─────────

type GmailThreadResponse = {
  id: string;
  historyId?: string;
  messages?: GmailFullMessage[];
};

export type GmailThreadMessage = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  receivedAt: Date;
  isRead: boolean;
};

/**
 * Lists every message in a thread with header-only metadata (no body).
 * Cheap relative to per-message fetches — Gmail returns the whole thread
 * shape in one call. Capped at 20 messages; longer threads link out to
 * Gmail rather than burn quota fetching dozens of headers.
 */
export async function listThreadMessages(
  accessToken: string,
  threadId: string,
  opts: { max?: number } = {}
): Promise<GmailThreadMessage[]> {
  const max = opts.max ?? 20;
  const params = new URLSearchParams();
  params.set('format', 'metadata');
  params.append('metadataHeaders', 'From');
  params.append('metadataHeaders', 'Subject');

  let data: GmailThreadResponse;
  try {
    data = await gfetch<GmailThreadResponse>(
      `/threads/${encodeURIComponent(threadId)}?${params.toString()}`,
      accessToken
    );
  } catch (e) {
    if (e instanceof GmailAuthError) throw e;
    return [];
  }

  const messages = (data.messages ?? []).slice(0, max);
  return messages.map<GmailThreadMessage>((m) => {
    const ts = m.internalDate ? Number(m.internalDate) : Date.now();
    return {
      id: m.id,
      threadId: m.threadId,
      from: headerOf(m.payload, 'From'),
      subject: headerOf(m.payload, 'Subject') || '',
      snippet: (m.snippet ?? '').trim(),
      receivedAt: new Date(ts),
      isRead: !(m.labelIds ?? []).includes('UNREAD'),
    };
  });
}

// ── Modify (archive / mark read / etc.) ────────────────────────

/**
 * Adds + removes labels on a Gmail message. The common operations
 * are wrappers over this:
 *   - Archive   = remove ['INBOX']
 *   - Mark read = remove ['UNREAD']
 *   - Trash     = the dedicated DELETE /messages/:id/trash endpoint
 *
 * Requires gmail.modify scope (gmail.readonly is insufficient).
 */
export async function modifyLabels(
  accessToken: string,
  messageId: string,
  args: { add?: string[]; remove?: string[] }
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (args.add?.length) body.addLabelIds = args.add;
  if (args.remove?.length) body.removeLabelIds = args.remove;
  if (Object.keys(body).length === 0) return;

  await gfetch(
    `/messages/${encodeURIComponent(messageId)}/modify`,
    accessToken,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
}

export async function archiveMessage(accessToken: string, messageId: string): Promise<void> {
  await modifyLabels(accessToken, messageId, { remove: ['INBOX'] });
}

export async function markMessageRead(accessToken: string, messageId: string): Promise<void> {
  await modifyLabels(accessToken, messageId, { remove: ['UNREAD'] });
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
