'use server';

import { generateText, jsonSchema, stepCountIs } from 'ai';
import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { aiGatewayConfigured, AI_MODEL_CHAT } from '@/lib/ai/gateway';
import { TOOL_DEFINITIONS, runTool } from '@/lib/ai/workspace-tools';

export type AskMessage = { role: 'user' | 'assistant'; content: string };
type Result = { ok: true; answer: string } | { ok: false; error: string };

/**
 * "Ask Ctrl K" — a conversational agent over the workspace. Wires the
 * existing workspace tools (customers, contracts, messages, notes, daily
 * brief) into the AI SDK's tool-calling loop, so the model can fetch real
 * data before answering. Everything is workspace-scoped via runTool's ctx.
 */
export async function askWorkspace(messages: AskMessage[]): Promise<Result> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();

  if (!aiGatewayConfigured()) {
    return { ok: false, error: 'KI ist nicht konfiguriert (AI_GATEWAY_API_KEY fehlt).' };
  }
  const trimmed = messages.filter((m) => m.content.trim()).slice(-12);
  if (trimmed.length === 0) return { ok: false, error: 'Leere Anfrage.' };

  const ctx = { workspaceId: ws.id, userId: user.id };
  // The rental/CRM tools are only exposed when the workspace opted into the
  // Vermietungs-Pack — keeps the assistant horizontal by default.
  const RENTAL_TOOLS = new Set(['searchCustomers', 'getCustomerDetail', 'listContracts']);
  const available = ws.rentalPack
    ? TOOL_DEFINITIONS
    : TOOL_DEFINITIONS.filter((t) => !RENTAL_TOOLS.has(t.name));
  const tools = Object.fromEntries(
    available.map((t) => [
      t.name,
      {
        description: t.description,
        inputSchema: jsonSchema(t.parameters as any),
        execute: async (args: Record<string, unknown>) => runTool(t.name, args as any, ctx),
      },
    ])
  );

  const now = new Date();
  try {
    const { text } = await generateText({
      model: AI_MODEL_CHAT,
      // Hard cap on tool-calling rounds so a confused model can't loop.
      stopWhen: stepCountIs(6),
      maxOutputTokens: 700,
      system:
        `Du bist „Ask Ctrl K", der Assistent im Operations-Hub von ${user.name}. ` +
        `Heute ist ${now.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}. ` +
        'Beantworte Fragen zum Workspace knapp und konkret auf Deutsch. ' +
        'Nutze die Tools, um echte Daten (Kunden, Verträge, Nachrichten, Notizen, Tagesbrief) zu holen, ' +
        'bevor du antwortest — rate nicht. Wenn etwas nicht in den Daten steht, sag das ehrlich. ' +
        'Antworte in kurzen Absätzen oder Stichpunkten, keine Floskeln.',
      messages: trimmed,
      tools: tools as any,
    });
    return { ok: true, answer: text.trim() || 'Dazu finde ich nichts.' };
  } catch (e) {
    console.error('[ask] failed', e);
    return { ok: false, error: 'KI-Anfrage fehlgeschlagen. Bitte erneut versuchen.' };
  }
}
