'use server';

import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { aiGenerate, aiGenerateJSON, aiAvailable, AI_MODEL_CHAT, AI_MODEL_FAST } from '@/lib/ai/gateway';
import { getAwaitingSplit } from '@/lib/db/queries/inbox-overview';

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

type EmailInput = { subject?: string | null; from?: string | null; bodyText?: string | null };

/**
 * A 2-3 sentence "morning briefing" for the inbox: what needs a reply and
 * which of your own threads have gone unanswered too long. Grounded in the
 * awaiting-split (no email bodies fetched), so it's cheap.
 */
export async function inboxDigest(): Promise<Result<{ digest: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  if (!(await aiAvailable(user.id))) return { ok: false, error: 'KI ist nicht konfiguriert.' };

  const split = await getAwaitingSplit(ws.id, user.id);
  const needsReply = split.onYou
    .slice(0, 10)
    .map((r) => `- ${r.senderName}: ${r.subject ?? '(kein Betreff)'} (vor ${r.ageDays}d)`);
  const overdue = split.onThem
    .filter((r) => r.ageDays >= 3)
    .slice(0, 10)
    .map(
      (r) =>
        `- an ${r.awaitingRecipient ?? r.senderName}: ${r.subject ?? '(kein Betreff)'} (seit ${r.ageDays}d keine Antwort)`
    );

  if (needsReply.length === 0 && overdue.length === 0) {
    return { ok: true, digest: 'Dein Posteingang ist ruhig — nichts wartet auf eine Antwort.' };
  }

  try {
    const digest = await aiGenerate({
      userId: user.id,
      model: AI_MODEL_FAST,
      maxOutputTokens: 220,
      temperature: 0.4,
      system:
        'Du bist ein knapper Posteingang-Assistent. Schreibe ein Morgen-Briefing in 2-3 Sätzen ' +
        'auf Deutsch: was heute am dringendsten eine Antwort braucht und welche eigenen Threads ' +
        'überfällig sind. Konkret mit Namen, keine Aufzählung, kein Vorwort.',
      prompt:
        `Braucht deine Antwort:\n${needsReply.join('\n') || '(nichts)'}\n\n` +
        `Du wartest überfällig auf:\n${overdue.join('\n') || '(nichts)'}`,
    });
    return { ok: true, digest: digest.trim() || 'Heute nichts Dringendes im Posteingang.' };
  } catch (e) {
    console.error('[inbox-ai] digest failed', e);
    return { ok: false, error: 'Briefing fehlgeschlagen.' };
  }
}

function context(input: EmailInput): string {
  const body = (input.bodyText ?? '').slice(0, 4000);
  return (
    `Betreff: ${input.subject || '(kein Betreff)'}\n` +
    `Von: ${input.from || '(unbekannt)'}\n\n` +
    `Inhalt:\n${body || '(kein Textinhalt verfügbar)'}`
  );
}

/**
 * Drafts a German reply to an inbox email. The body text is passed in from
 * the client (it's fetched from Gmail at render time, not stored), so this
 * action never re-hits Gmail. Returns a draft for the user to edit/copy —
 * it does not send.
 */
export async function draftInboxReply(
  input: EmailInput & { instruction?: string }
): Promise<Result<{ draft: string }>> {
  const user = await requireUser();
  await requireCurrentWorkspace();
  if (!(await aiAvailable(user.id))) return { ok: false, error: 'KI ist nicht konfiguriert.' };

  try {
    const draft = await aiGenerate({
      userId: user.id,
      model: AI_MODEL_CHAT,
      maxOutputTokens: 500,
      temperature: 0.6,
      system:
        'Du schreibst eine professionelle, freundliche, knappe E-Mail-Antwort auf Deutsch. ' +
        'Gib NUR den E-Mail-Text zurück (Anrede bis Grußformel), keine Betreffzeile, keine Erklärung. ' +
        'Behalte den Ton der Eingangsmail bei (Sie/Du wie im Original).',
      prompt:
        context(input) +
        (input.instruction ? `\n\nZusätzliche Anweisung: ${input.instruction}` : '') +
        '\n\nSchreibe eine passende Antwort.',
    });
    return { ok: true, draft: draft.trim() };
  } catch (e) {
    console.error('[inbox-ai] draft failed', e);
    return { ok: false, error: 'Entwurf fehlgeschlagen.' };
  }
}

/**
 * Summarizes an inbox email into a one-paragraph gist plus concrete action
 * items (so the user can decide fast / turn items into todos).
 */
export async function summarizeInboxEmail(
  input: EmailInput
): Promise<Result<{ summary: string; actions: string[] }>> {
  const user = await requireUser();
  await requireCurrentWorkspace();
  if (!(await aiAvailable(user.id))) return { ok: false, error: 'KI ist nicht konfiguriert.' };

  try {
    const parsed = await aiGenerateJSON<{ summary?: string; actions?: string[] }>({
      userId: user.id,
      model: AI_MODEL_FAST,
      maxOutputTokens: 400,
      system:
        'Du fasst E-Mails auf Deutsch zusammen. Antworte NUR mit JSON: ' +
        '{ "summary": string (1-2 Sätze, worum es geht), "actions": string[] (konkrete ToDos für den Empfänger, leer wenn keine) }.',
      prompt: context(input),
    });
    if (!parsed) return { ok: false, error: 'Zusammenfassung fehlgeschlagen.' };
    return {
      ok: true,
      summary: (parsed.summary ?? '').trim() || 'Keine Zusammenfassung möglich.',
      actions: Array.isArray(parsed.actions) ? parsed.actions.filter((a) => typeof a === 'string').slice(0, 6) : [],
    };
  } catch (e) {
    console.error('[inbox-ai] summarize failed', e);
    return { ok: false, error: 'Zusammenfassung fehlgeschlagen.' };
  }
}
