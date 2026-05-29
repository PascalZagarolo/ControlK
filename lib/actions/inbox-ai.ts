'use server';

import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { aiGenerate, aiGenerateJSON, aiGatewayConfigured, AI_MODEL_CHAT, AI_MODEL_FAST } from '@/lib/ai/gateway';

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

type EmailInput = { subject?: string | null; from?: string | null; bodyText?: string | null };

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
  await requireUser();
  await requireCurrentWorkspace();
  if (!aiGatewayConfigured()) return { ok: false, error: 'KI ist nicht konfiguriert.' };

  try {
    const draft = await aiGenerate({
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
  await requireUser();
  await requireCurrentWorkspace();
  if (!aiGatewayConfigured()) return { ok: false, error: 'KI ist nicht konfiguriert.' };

  try {
    const parsed = await aiGenerateJSON<{ summary?: string; actions?: string[] }>({
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
