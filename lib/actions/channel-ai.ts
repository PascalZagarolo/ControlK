'use server';

import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import {
  aiGenerate,
  aiGenerateJSON,
  aiGatewayConfigured,
  AI_MODEL_CHAT,
  AI_MODEL_FAST,
} from '@/lib/ai/gateway';

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
type Msg = { author: string; body: string };
type Base = { channelName: string; messages: Msg[] };

function transcript(input: Base): string {
  const recent = input.messages.slice(-40);
  const lines = recent.map((m) => `${m.author}: ${(m.body ?? '').slice(0, 500)}`).join('\n');
  return `Channel #${input.channelName}\n\nVerlauf (älteste zuerst):\n${lines || '(keine Nachrichten)'}`;
}

/** "Hol mich ab" — summarize the recent channel conversation. */
export async function channelSummary(
  input: Base
): Promise<Result<{ summary: string; openItems: string[] }>> {
  await requireUser();
  await requireCurrentWorkspace();
  if (!aiGatewayConfigured()) return { ok: false, error: 'KI ist nicht konfiguriert.' };
  if (input.messages.length === 0) return { ok: false, error: 'Noch keine Nachrichten.' };

  try {
    const parsed = await aiGenerateJSON<{ summary?: string; openItems?: string[] }>({
      model: AI_MODEL_FAST,
      maxOutputTokens: 450,
      system:
        'Du fasst eine Team-Channel-Unterhaltung auf Deutsch zusammen. Antworte NUR mit JSON: ' +
        '{ "summary": string (worüber gesprochen wurde, 2-4 Sätze), "openItems": string[] (offene Fragen / To-dos / Entscheidungen, leer wenn keine) }.',
      prompt: transcript(input),
    });
    if (!parsed) return { ok: false, error: 'Zusammenfassung fehlgeschlagen.' };
    return {
      ok: true,
      summary: (parsed.summary ?? '').trim() || 'Keine Zusammenfassung möglich.',
      openItems: Array.isArray(parsed.openItems)
        ? parsed.openItems.filter((x) => typeof x === 'string').slice(0, 8)
        : [],
    };
  } catch (e) {
    console.error('[channel-ai] summary failed', e);
    return { ok: false, error: 'Zusammenfassung fehlgeschlagen.' };
  }
}

/** Draft a reply to the latest message, grounded in the conversation. */
export async function channelReplyDraft(
  input: Base & { instruction?: string }
): Promise<Result<{ draft: string }>> {
  await requireUser();
  await requireCurrentWorkspace();
  if (!aiGatewayConfigured()) return { ok: false, error: 'KI ist nicht konfiguriert.' };

  try {
    const draft = await aiGenerate({
      model: AI_MODEL_CHAT,
      maxOutputTokens: 350,
      temperature: 0.6,
      system:
        'Du schlägst eine kurze, natürliche Chat-Antwort auf Deutsch vor, passend zum Tonfall des Channels. ' +
        'Gib NUR den Nachrichtentext zurück, ohne Anführungszeichen oder Erklärung.',
      prompt:
        transcript(input) +
        (input.instruction ? `\n\nAnweisung: ${input.instruction}` : '') +
        '\n\nSchreibe eine passende nächste Nachricht.',
    });
    return { ok: true, draft: draft.trim() };
  } catch (e) {
    console.error('[channel-ai] reply failed', e);
    return { ok: false, error: 'Entwurf fehlgeschlagen.' };
  }
}

/** /ai — answer a question grounded in the channel's recent messages. */
export async function channelAsk(
  input: Base & { question: string }
): Promise<Result<{ answer: string }>> {
  await requireUser();
  await requireCurrentWorkspace();
  if (!aiGatewayConfigured()) return { ok: false, error: 'KI ist nicht konfiguriert.' };
  if (!input.question.trim()) return { ok: false, error: 'Leere Frage.' };

  try {
    const answer = await aiGenerate({
      model: AI_MODEL_CHAT,
      maxOutputTokens: 450,
      temperature: 0.4,
      system:
        'Du beantwortest eine Frage zum Verlauf eines Team-Channels auf Deutsch, knapp und konkret. ' +
        'Stützt dich nur auf den Verlauf; wenn die Antwort nicht drinsteht, sag das.',
      prompt: `${transcript(input)}\n\nFrage: ${input.question.trim()}`,
    });
    return { ok: true, answer: answer.trim() };
  } catch (e) {
    console.error('[channel-ai] ask failed', e);
    return { ok: false, error: 'Anfrage fehlgeschlagen.' };
  }
}
