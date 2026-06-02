'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { aiGenerate, aiAvailable, AI_MODEL_CHAT } from '@/lib/ai/gateway';
import { getValidGoogleAccessToken, getGoogleConnection } from '@/lib/auth/google-tokens';
import {
  listThreadMessages,
  getFullMessage,
  markMessageRead,
  parseFromHeader,
  sendReply as gmailSendReply,
} from '@/lib/google/gmail';

// Thread-aware AI reply drafting + sending from Ctrl+K.
//
// CONSUMES: the existing Gmail wrapper (thread fetch + new sendReply), the AI
// gateway (aiGenerate + aiAvailable), and the OAuth token pipeline. The draft
// reads the WHOLE thread (not just the current message) so the answer has
// context. Sending is gated on the gmail.send scope and NEVER happens without
// an explicit user click — the UI calls sendReply only after the user reviews.

const GMAIL_SEND = 'https://www.googleapis.com/auth/gmail.send';
const MAX_THREAD_MSGS = 6;
const MAX_BODY_CHARS = 2500;

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

async function loadItem(workspaceId: string, userId: string, inboxItemId: string) {
  const db = getDb();
  return db.query.inboxItems.findFirst({
    where: and(
      eq(s.inboxItems.id, inboxItemId),
      eq(s.inboxItems.workspaceId, workspaceId),
      eq(s.inboxItems.userId, userId)
    ),
  });
}

/** Whether the user has granted Gmail's send scope (drives the UI gate). */
export async function hasSendScope(): Promise<boolean> {
  const user = await requireUser();
  const conn = await getGoogleConnection(user.id).catch(() => null);
  return !!conn && conn.scopes.includes(GMAIL_SEND);
}

/**
 * Draft a reply by reading the whole thread. Returns the proposed text plus
 * the recipient + whether sending is unlocked, so the UI can show the right
 * action. Does NOT send.
 */
export async function draftReply(input: {
  inboxItemId: string;
  instruction?: string;
}): Promise<Result<{ draft: string; to: string | null; subject: string; canSend: boolean }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  if (!(await aiAvailable(user.id))) return { ok: false, error: 'KI ist nicht konfiguriert.' };

  const item = await loadItem(ws.id, user.id, input.inboxItemId);
  if (!item) return { ok: false, error: 'Mail nicht gefunden.' };
  // Replying only makes sense for received mail — a 'sent' item's "sender" is
  // the user, so a reply would target themselves.
  if (item.direction === 'sent') {
    return { ok: false, error: 'Auf gesendete Mails kann nicht geantwortet werden.' };
  }
  if (!item.senderEmail) return { ok: false, error: 'Keine Empfängeradresse erkennbar.' };

  const token = await getValidGoogleAccessToken(user.id).catch(() => null);
  if (!token) return { ok: false, error: 'Gmail ist nicht verbunden.' };

  // Resolve the thread id — fall back to the message's own threadId when the
  // synced row didn't capture sourceThreadId (older items).
  const currentBody = await getFullMessage(token, item.sourceId).catch(() => null);
  const threadId = item.sourceThreadId ?? currentBody?.threadId ?? null;

  // Build the conversation arc (oldest→newest, bodies capped). Falls back to
  // just the current message if the thread can't be loaded.
  let arc = '';
  if (threadId) {
    const msgs = await listThreadMessages(token, threadId, { max: 20 }).catch(() => []);
    const recent = msgs.slice(-MAX_THREAD_MSGS);
    const bodies = await Promise.all(recent.map((m) => getFullMessage(token, m.id).catch(() => null)));
    arc = bodies
      .filter((b): b is NonNullable<typeof b> => !!b)
      .map((b) => `Von: ${parseFromHeader(b.from).name} (${b.date.toISOString().slice(0, 10)})\n${(b.plain || '').slice(0, MAX_BODY_CHARS)}`)
      .join('\n\n---\n\n');
  }
  if (!arc) {
    arc = `Von: ${item.senderName} (${(item.receivedAt ? new Date(item.receivedAt) : new Date()).toISOString().slice(0, 10)})\n${(currentBody?.plain || item.preview || '').slice(0, MAX_BODY_CHARS)}`;
  }

  try {
    const draft = await aiGenerate({
      userId: user.id,
      model: AI_MODEL_CHAT,
      maxOutputTokens: 600,
      temperature: 0.6,
      system:
        'Du schreibst im Namen des Nutzers eine professionelle, freundliche, knappe ' +
        'E-Mail-Antwort. Antworte in der SPRACHE des Verlaufs (Standard: Deutsch). Lies den ' +
        'GESAMTEN Verlauf und antworte auf die JÜNGSTE Nachricht. Gib NUR den E-Mail-Text ' +
        'zurück (Anrede bis Grußformel), keine Betreffzeile, keine Erklärung. Behalte den Ton ' +
        'bei (Sie/Du wie im Verlauf). Erfinde KEINE Fakten, Zahlen oder Zusagen, die nicht im ' +
        'Verlauf stehen — wenn etwas offen ist, formuliere es als Rückfrage.',
      prompt:
        `E-Mail-Verlauf (älteste zuerst):\n\n${arc}` +
        (input.instruction ? `\n\nZusätzliche Anweisung: ${input.instruction}` : '') +
        '\n\nSchreibe die Antwort.',
    });
    return {
      ok: true,
      draft: draft.trim(),
      to: item.senderEmail,
      subject: item.subject ?? '',
      canSend: await hasSendScope(),
    };
  } catch (e) {
    console.error('[reply] draft failed', e);
    return { ok: false, error: 'Entwurf fehlgeschlagen.' };
  }
}

/**
 * Send the (user-reviewed) reply into the original Gmail thread. Gated on the
 * send scope; the caller only invokes this after an explicit confirm.
 */
export async function sendReply(input: {
  inboxItemId: string;
  body: string;
  subject?: string;
}): Promise<Result> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();

  const body = input.body.trim();
  if (!body) return { ok: false, error: 'Die Antwort ist leer.' };

  const item = await loadItem(ws.id, user.id, input.inboxItemId);
  if (!item) return { ok: false, error: 'Mail nicht gefunden.' };
  if (item.direction === 'sent') {
    return { ok: false, error: 'Auf gesendete Mails kann nicht geantwortet werden.' };
  }
  if (!item.senderEmail) return { ok: false, error: 'Keine Empfängeradresse erkennbar.' };

  if (!(await hasSendScope())) {
    return { ok: false, error: 'Senden ist noch nicht freigeschaltet.' };
  }
  const token = await getValidGoogleAccessToken(user.id).catch(() => null);
  if (!token) return { ok: false, error: 'Gmail ist nicht verbunden.' };

  // Threading headers from the message being replied to.
  const full = await getFullMessage(token, item.sourceId).catch(() => null);

  try {
    await gmailSendReply(token, {
      threadId: item.sourceThreadId ?? full?.threadId ?? item.sourceId,
      to: item.senderEmail,
      subject: input.subject?.trim() || item.subject || '',
      inReplyTo: full?.messageId ?? null,
      references: full?.references ?? null,
      bodyText: body,
    });
  } catch (e) {
    console.error('[reply] send failed', e);
    return { ok: false, error: 'Senden fehlgeschlagen.' };
  }

  // We've handled it — mark read so it leaves "braucht Antwort". Best-effort.
  await markMessageRead(token, item.sourceId).catch(() => {});
  revalidatePath('/inbox');
  revalidatePath(`/inbox/${item.id}`);
  revalidatePath('/inbox/clients');
  revalidatePath('/plan');
  revalidatePath('/kunden');
  return { ok: true };
}
