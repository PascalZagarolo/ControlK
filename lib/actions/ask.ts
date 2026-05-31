'use server';

import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { getEffectiveAIKey } from '@/lib/ai/get-effective-key';
import { TOOL_DEFINITIONS, runTool } from '@/lib/ai/workspace-tools';

export type AskMessage = { role: 'user' | 'assistant'; content: string };
type Result = { ok: true; answer: string } | { ok: false; error: string };

const RENTAL_TOOLS = new Set(['searchCustomers', 'getCustomerDetail', 'listContracts']);
const MAX_ROUNDS = 6;

/**
 * "Ask Ctrl K" — a conversational agent over the workspace. Runs an
 * OpenAI-compatible tool-calling loop against the user's effective AI
 * endpoint (BYOK → gateway → OPENAI_API_KEY), wiring in the existing
 * workspace tools. The rental/CRM tools are only exposed when the workspace
 * opted into the Vermietungs-Pack — keeps the assistant horizontal by default.
 */
export async function askWorkspace(messages: AskMessage[]): Promise<Result> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();

  const key = await getEffectiveAIKey(user.id);
  if (!key) return { ok: false, error: 'KI ist nicht konfiguriert (kein Schlüssel hinterlegt).' };

  const trimmed = messages.filter((m) => m.content.trim()).slice(-12);
  if (trimmed.length === 0) return { ok: false, error: 'Leere Anfrage.' };

  const ctx = { workspaceId: ws.id, userId: user.id };
  const defs = ws.rentalPack
    ? TOOL_DEFINITIONS
    : TOOL_DEFINITIONS.filter((t) => !RENTAL_TOOLS.has(t.name));
  const tools = defs.map((t) => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

  const now = new Date();
  const chat: any[] = [
    {
      role: 'system',
      content:
        `Du bist „Ask Ctrl K", der Assistent im Workspace von ${user.name}. ` +
        `Heute ist ${now.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}. ` +
        'Beantworte Fragen zum Workspace knapp und konkret auf Deutsch. Nutze die Tools, um echte ' +
        'Daten zu holen, bevor du antwortest — rate nicht. Steht etwas nicht in den Daten, sag das ehrlich.',
    },
    ...trimmed.map((m) => ({ role: m.role, content: m.content })),
  ];

  const url = `${key.baseUrl}/chat/completions`;
  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key.apiKey}` },
        body: JSON.stringify({
          model: key.defaultModel,
          messages: chat,
          tools,
          tool_choice: 'auto',
          temperature: 0.3,
          max_tokens: 700,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) return { ok: false, error: `KI-Anfrage fehlgeschlagen (${res.status}).` };
      const data = await res.json();
      const msg = data?.choices?.[0]?.message;
      if (!msg) return { ok: false, error: 'Keine Antwort vom Modell.' };

      if (msg.tool_calls?.length > 0) {
        chat.push(msg);
        for (const call of msg.tool_calls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.function?.arguments ?? '{}');
          } catch {}
          const result = await runTool(call.function?.name, args as any, ctx);
          chat.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(result).slice(0, 4000),
          });
        }
        continue;
      }

      return { ok: true, answer: (msg.content ?? '').trim() || 'Dazu finde ich nichts.' };
    }
    return { ok: true, answer: 'Das war mir zu verschachtelt — frag bitte etwas konkreter.' };
  } catch (e) {
    console.error('[ask] failed', e);
    return { ok: false, error: 'KI-Anfrage fehlgeschlagen. Bitte erneut versuchen.' };
  }
}
